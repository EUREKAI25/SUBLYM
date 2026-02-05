"""
Sublym v4 - Image Validator
Validation des keyframes générées avec triple validation faciale
"""

import json
import re
import urllib.request
import base64
from pathlib import Path
from typing import Dict, List, Any, Optional

from .env_loader import get_api_key
from config.settings import DEFAULT_MODELS
from .face_validator import FaceValidator


class ImageValidator:
    """Valide les keyframes générées."""

    def __init__(self, config: Dict, dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.model = config.get("models", {}).get("vision", DEFAULT_MODELS["vision"])
        self.strict_prefix = config.get("prompt_strict_prefix", "")
        self.strict_suffix = config.get("prompt_strict_suffix", "")
        self.validation_config = config.get("validation_config", {})
        self.global_min_score = config.get("global_min_score", 0.75)
        
        # Face validator sera initialisé avec le run_dir
        self.face_validator: Optional[FaceValidator] = None
        
        # Tracking
        self.costs_real = {"tokens_input": 0, "tokens_output": 0, "calls": 0}
        self.failures = []
        self.all_validations = []  # Track ALL validations with full details
    
    def set_run_dir(self, run_dir: str):
        """Initialise le FaceValidator avec le répertoire de run."""
        self.face_validator = FaceValidator(self.config, run_dir, self.verbose)
    
    def validate(
        self,
        image_path: str,
        references: Dict[str, Optional[str]],
        scene_id: int,
        kf_type: str,
        palette: List[str],
        description: str,
        attempt: int = 1,
        extra_criteria: Optional[Dict] = None,
        shot_type: str = "medium",
        expected_faces: int = 1,
    ) -> Dict[str, Any]:
        """
        Valide une keyframe générée.

        Args:
            image_path: Chemin de l'image générée
            references: {"user_photo": path, "previous": path, "start_current": path}
            scene_id: ID de la scène
            kf_type: "start" ou "end"
            palette: Palette de couleurs
            description: Description attendue
            attempt: Numéro de tentative
            extra_criteria: Critères de validation additionnels (ex: pub_transition)

        Returns:
            {"passed": bool, "global_score": float, "failures": list, "face_validation": dict}
        """
        if self.dry_run:
            return {"passed": True, "global_score": 0.95, "failures": [], "face_validation": None}

        # 1. Validation Gemini (optionnelle - seulement si modèle vision configuré)
        gemini_result = None
        gemini_score = 0.0
        gemini_passed = True  # Pas de Gemini = pas de blocage Gemini

        if self.model:
            gemini_result = self._validate_with_gemini(
                image_path, references, scene_id, kf_type, palette, description,
                extra_criteria=extra_criteria
            )
            gemini_score = gemini_result.get("global_score", 0)
            gemini_passed = gemini_result.get("passed", False)

        # 2. Validation faciale biométrique (DeepFace + ArcFace uniquement, PAS Gemini)
        face_result = None
        if references.get("user_photo") and self.face_validator:
            face_result = self.face_validator.validate(
                generated_image_path=image_path,
                reference_image_path=references["user_photo"],
                scene_id=scene_id,
                kf_type=kf_type,
                attempt=attempt,
                shot_type=shot_type,
                expected_faces=expected_faces,
            )

        # 3. Décision finale
        # Biométrie = seule autorité pour le visage. Gemini = décor/tenue/accessoires.
        face_passed = face_result["passed"] if face_result else True

        if self.model:
            final_passed = gemini_passed and face_passed
        else:
            final_passed = face_passed

        # Collecter les échecs
        failures = gemini_result.get("failures", []) if gemini_result else []
        if face_result and not face_result["passed"]:
            failures.append(f"Face validation: {face_result['reason']}")

        # Track ALL validations with full details
        validation_record = {
            "scene_id": scene_id,
            "kf_type": kf_type,
            "attempt": attempt,
            "passed": final_passed,
            "gemini_score": gemini_score,
            "gemini_is_same_person": gemini_result.get("is_same_person") if gemini_result else None,
            "gemini_scores": gemini_result.get("scores", {}) if gemini_result else {},
            "gemini_major_issues": gemini_result.get("major_issues", []) if gemini_result else [],
            "face_result": face_result,
            "failures": failures,
            "image_path": image_path,
            "description": description[:200] if description else None,
        }
        self.all_validations.append(validation_record)

        if not final_passed:
            self.failures.append({
                "scene_id": scene_id,
                "kf_type": kf_type,
                "attempt": attempt,
                "gemini_score": gemini_score,
                "face_result": face_result,
                "failures": failures
            })

        return {
            "passed": final_passed,
            "global_score": gemini_score if gemini_result else (1.0 if face_passed else 0.0),
            "failures": failures,
            "face_validation": face_result,
            "gemini_result": gemini_result
        }
    
    def _validate_with_gemini(
        self,
        image_path: str,
        references: Dict[str, Optional[str]],
        scene_id: int,
        kf_type: str,
        palette: List[str],
        description: str,
        extra_criteria: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Validation via Gemini Vision."""

        # Construire le prompt de validation
        prompt = self._build_validation_prompt(
            references, scene_id, kf_type, palette, description,
            extra_criteria=extra_criteria
        )
        
        if self.verbose:
            print(f"\n--- PROMPT VALIDATION ---\n{prompt}\n---")
        
        # Préparer les images
        images = [self._encode_image(image_path)]
        
        if references.get("user_photo"):
            images.insert(0, self._encode_image(references["user_photo"]))
        
        if kf_type == "end" and references.get("start_current"):
            images.append(self._encode_image(references["start_current"]))
        
        # Appel Gemini
        try:
            response = self._call_gemini(prompt, images)
        except Exception as e:
            print(f"      ⚠️ Gemini vision call failed: {e}")
            return {"passed": True, "global_score": 0.0, "failures": [], "scores": {}, "major_issues": [f"Gemini error: {e}"], "gemini_skipped": True}

        result = self._parse_json(response)

        # Si parse error, Gemini ne bloque pas (face validation décide seule)
        if "Parse error" in result.get("major_issues", []):
            if self.verbose:
                print(f"      ⚠️ Gemini parse error — raw response (first 500 chars):")
                print(f"      {response[:500]}")
            return {"passed": True, "global_score": 0.0, "failures": [], "scores": {}, "major_issues": ["Parse error — Gemini skipped"], "gemini_skipped": True}

        # Fusionner critères de base + extra pour lookup des seuils
        all_criteria = dict(self.validation_config)
        if extra_criteria:
            all_criteria.update(extra_criteria)

        # ===== DEBUG: Afficher TOUS les scores Gemini critère par critère =====
        print(f"\n      {'='*60}")
        print(f"      GEMINI VALIDATION DETAIL (scene {scene_id} {kf_type})")
        print(f"      {'='*60}")
        scores_dict = result.get("scores", {})
        for code, data in scores_dict.items():
            if isinstance(data, dict):
                score = data.get("score", "?")
                comment = data.get("comment", "")
                cfg = all_criteria.get(code, {})
                min_score = cfg.get("min", 0.7)
                status = "✅" if (isinstance(score, (int, float)) and score >= min_score) else "❌"
                print(f"      {status} {code}: {score} (min: {min_score}) — {comment[:80]}")
            else:
                print(f"      ⚠️  {code}: {data} (non-dict value)")

        global_score = result.get("global_score", 0)
        is_same_person = result.get("is_same_person", True)
        major_issues = result.get("major_issues", [])
        print(f"      ---")
        print(f"      GLOBAL SCORE: {global_score}")
        print(f"      IS SAME PERSON: {is_same_person}")
        if major_issues:
            print(f"      MAJOR ISSUES: {major_issues}")
        print(f"      {'='*60}")
        # ===== FIN DEBUG =====

        # Gemini ne décide PAS de l'identité faciale (biométrique uniquement)
        passed = global_score >= self.global_min_score

        # Lister les échecs (critères non-face uniquement)
        failures = []
        face_criteria_codes = {"face_shape", "face_features", "skin_tone"}
        for code, data in scores_dict.items():
            if not isinstance(data, dict):
                continue
            if code in face_criteria_codes:
                continue  # Face = biométrique, pas Gemini
            cfg = all_criteria.get(code, {})
            min_score = cfg.get("min", 0.7)
            if data.get("score", 1) < min_score:
                failures.append(f"{code}: {data.get('score', 0):.2f} < {min_score}")

        result["passed"] = passed
        result["failures"] = failures

        return result
    
    def _build_validation_prompt(
        self,
        references: Dict,
        scene_id: int,
        kf_type: str,
        palette: List[str],
        description: str,
        extra_criteria: Optional[Dict] = None
    ) -> str:
        """Construit le prompt de validation."""

        # Fusionner critères de base + critères additionnels
        all_criteria = dict(self.validation_config)
        if extra_criteria:
            all_criteria.update(extra_criteria)

        # Séparer les critères par groupe de référence
        face_criteria = []
        scene_criteria = []
        context_criteria = []
        quality_criteria = []

        for code, cfg in all_criteria.items():
            ref = cfg.get("ref", "none")
            label = cfg.get("label", code)
            min_score = cfg.get("min", 0.7)
            examples = cfg.get("examples_fail", [])
            line = f"- {code}: {label} [min: {min_score}]"
            if examples:
                line += f" Examples of failure: {'; '.join(examples[:2])}"
            if ref == "user_photo" or ref == "character_analysis":
                face_criteria.append(line)
            elif ref == "dream_context":
                context_criteria.append(line)
            elif ref in ("pitch", "scene_palette", "previous", "start_current"):
                scene_criteria.append(line)
            else:
                quality_criteria.append(line)

        face_str = "\n".join(face_criteria)
        scene_str = "\n".join(scene_criteria)
        context_str = "\n".join(context_criteria)
        quality_str = "\n".join(quality_criteria)

        palette_str = ", ".join(palette) if palette else "non spécifiée"

        # Images envoyées:
        # [0] = user_photo (référence)
        # [1] = image générée
        # [2] = start_current (si end keyframe)
        has_start = kf_type == "end" and references.get("start_current")

        image_labels = "IMAGE 1 = REFERENCE PHOTO (the real person)\nIMAGE 2 = GENERATED IMAGE (to evaluate)"
        if has_start:
            image_labels += "\nIMAGE 3 = START KEYFRAME of this same scene (for consistency check)"

        prompt = f"""Compare IMAGE 2 (generated) against IMAGE 1 (reference photo of the real person).
{image_labels}

Scene requested: {description}
Palette: {palette_str}

IDENTITY (is it the same person as reference?):
{face_str}

SCENE FIDELITY (does it match the description?):
{scene_str}
{f"CONTEXT: {context_str}" if context_str else ""}

TECHNICAL QUALITY:
{quality_str}

Score 0-1 (1=identical, 0.8=very similar, 0.5=moderate, 0=different).
Compare clothing/location against SCENE DESCRIPTION, not reference photo.
Reference photo is ONLY for identity (face, body, hair, skin).

Reply in JSON:
{{
    "scores": {{"criterion_code": {{"score": 0.0, "comment": "explanation"}}}},
    "global_score": 0.0,
    "is_same_person": true|false,
    "major_issues": ["list of problems"]
}}
"""
        return prompt
    
    def _encode_image(self, path: str) -> str:
        """Encode une image en base64."""
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    
    def _call_gemini(self, prompt: str, images: List[str]) -> str:
        """Appelle Gemini Vision."""
        api_key = get_api_key("GEMINI_API_KEY")
        
        # Construire les parts
        parts = []
        for img in images:
            parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": img
                }
            })
        parts.append({"text": prompt})
        
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 4000,
                "responseMimeType": "application/json"
            }
        }
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={api_key}"
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
        
        # Track usage
        usage = result.get("usageMetadata", {})
        self.costs_real["tokens_input"] += usage.get("promptTokenCount", 0)
        self.costs_real["tokens_output"] += usage.get("candidatesTokenCount", 0)
        self.costs_real["calls"] += 1
        
        try:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            # Safety filter ou réponse vide
            finish_reason = result.get("candidates", [{}])[0].get("finishReason", "unknown")
            raise ValueError(f"Gemini vision: pas de texte dans la réponse (finishReason={finish_reason})")
    
    def _parse_json(self, text: str) -> Dict:
        """Parse le JSON de la réponse."""
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```\w*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
        return {"global_score": 0.5, "is_same_person": False, "scores": {}, "major_issues": ["Parse error"]}
    
    def get_real_cost(self) -> float:
        """Coût réel Gemini Vision."""
        # Gemini 2.0 Flash pricing approximatif
        input_cost = (self.costs_real["tokens_input"] / 1000) * 0.0001
        output_cost = (self.costs_real["tokens_output"] / 1000) * 0.0004
        return input_cost + output_cost
    
    def get_failure_report(self) -> str:
        """Retourne un rapport des échecs."""
        if not self.failures:
            return "Aucune validation échouée"

        lines = [f"\n📊 RAPPORT VALIDATIONS ({len(self.failures)} échecs):"]
        for f in self.failures[-10:]:  # Derniers 10
            lines.append(f"   Scene {f['scene_id']} {f['kf_type']} (att {f['attempt']}): {f['failures'][:2]}")

        if self.face_validator:
            lines.append(f"\n{self.face_validator.get_summary()}")

        return "\n".join(lines)

    def get_validation_data(self) -> Dict[str, Any]:
        """Retourne les données de validation en format JSON-serializable."""
        face_data = None
        if self.face_validator:
            face_data = self.face_validator.get_data() if hasattr(self.face_validator, 'get_data') else None

        return {
            "total_validations": len(self.all_validations),
            "total_passed": sum(1 for v in self.all_validations if v["passed"]),
            "total_failures": len(self.failures),
            "pass_rate": (sum(1 for v in self.all_validations if v["passed"]) / len(self.all_validations) * 100) if self.all_validations else 0,
            "all_validations": self.all_validations,  # Full details for each validation
            "failures": self.failures,
            "face_validation": face_data,
            "costs": self.costs_real,
            "config": {
                "global_min_score": self.global_min_score,
                "validation_criteria": self.validation_config,
                "model": self.model,
            }
        }
