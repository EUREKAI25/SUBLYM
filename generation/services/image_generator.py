"""
Sublym v4 - Image Generator
Génère les keyframes via Gemini SDK - PART TOUJOURS DE LA PHOTO USER
"""

import base64
from typing import Dict, List, Optional
from pathlib import Path

from .env_loader import get_api_key
from config.settings import DEFAULT_MODELS
from prompts.templates import PROMPT_IMAGE_GENERATE, PROMPT_IMAGE_POV, PROMPT_IMAGE_SAME_DAY_RULES


class ImageGenerator:
    """Génère les images via Gemini SDK."""

    def __init__(self, config: Dict, dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.model = config.get("models", {}).get("image", DEFAULT_MODELS["image"])
        self.strict_prefix = config.get("prompt_strict_prefix", "")
        self.strict_suffix = config.get("prompt_strict_suffix", "")
        
        self.costs_real = {"tokens_input": 0, "tokens_output": 0, "images": 0}
        self._client = None
    
    def _get_client(self):
        """Lazy init du client Gemini."""
        if self._client is None:
            try:
                from google import genai
            except ImportError:
                raise ImportError("Installez le SDK: pip install google-genai")
            
            api_key = get_api_key("GEMINI_API_KEY")
            self._client = genai.Client(api_key=api_key)
        return self._client
    
    def generate_keyframe(
        self,
        scene_description: Dict,
        shooting_specs: Dict,
        reference_images: List[str],
        scene_palette: List[str],
        is_same_day: bool = True,
        is_pov: bool = False,
        output_path: Optional[str] = None,
        allows_camera_look: bool = False
    ) -> Dict:
        """
        Génère un keyframe en partant de la photo de référence.
        
        IMPORTANT: On ne décrit pas une personne, on PLACE la personne 
        de la photo de référence dans la situation.
        """
        
        # Construire le prompt AVANT le dry_run check pour que verbose fonctionne
        if is_pov:
            prompt = self._build_pov_prompt(scene_description, shooting_specs, scene_palette)
        else:
            prompt = self._build_standard_prompt(scene_description, shooting_specs, scene_palette, is_same_day, allows_camera_look)
        
        if self.verbose:
            print(f"\n--- PROMPT IMAGE ---\n{prompt}\n---")
        
        if self.dry_run:
            return self._mock_generate(output_path)
        
        return self._call_gemini(prompt, reference_images, output_path, is_pov)
    
    def _build_standard_prompt(self, desc: Dict, shooting: Dict, palette: List[str], is_same_day: bool, allows_camera_look: bool = False) -> str:
        """Construit le prompt de modification d'image directe."""

        same_day_rules = PROMPT_IMAGE_SAME_DAY_RULES if is_same_day else ""

        # Ajuster la direction du regard si camera look autorisé
        gaze = desc.get("gaze_direction", "away_left")
        if allows_camera_look:
            gaze = "toward_camera, warm satisfied smile"
            camera_look_rule = "Look directly at camera with a warm, satisfied smile"
        else:
            camera_look_rule = "Never look at camera"

        prompt = PROMPT_IMAGE_GENERATE.format(
            description=desc.get("description", ""),
            location=desc.get("location", ""),
            pose=desc.get("pose", ""),
            expression=desc.get("expression", ""),
            expression_intensity=desc.get("expression_intensity", "moderate"),
            gaze_direction=gaze,
            outfit=desc.get("outfit", ""),
            accessories=desc.get("accessories", ""),
            scene_palette=", ".join(palette) if palette else "non spécifiée",
            shot_type=shooting.get("shot_type", "medium"),
            camera_angle=shooting.get("camera_angle", "eye_level"),
            lighting_direction=shooting.get("lighting_direction", "side"),
            lighting_temperature=shooting.get("lighting_temperature", "warm"),
            depth_of_field=shooting.get("depth_of_field", "shallow"),
            focus_on=shooting.get("focus_on", "face"),
            same_day_rules=same_day_rules,
            camera_look_rule=camera_look_rule,
        )

        return prompt
    
    def _build_pov_prompt(self, desc: Dict, shooting: Dict, palette: List[str]) -> str:
        """Construit le prompt POV (pas de personnage visible)."""

        return PROMPT_IMAGE_POV.format(
            description=desc.get("description", ""),
            foreground=desc.get("foreground", ""),
            midground=desc.get("midground", ""),
            background=desc.get("background", ""),
            lighting=desc.get("lighting", ""),
            scene_palette=", ".join(palette) if palette else "non spécifiée",
            depth_of_field=shooting.get("depth_of_field", "shallow"),
            lighting_temperature=shooting.get("lighting_temperature", "warm"),
        )
    
    def _call_gemini(self, prompt: str, image_paths: List[str], output_path: Optional[str], is_pov: bool = False) -> Dict:
        """Appel Gemini SDK avec images de référence."""
        
        try:
            from google.genai import types
        except ImportError:
            raise ImportError("Installez le SDK: pip install google-genai")
        
        client = self._get_client()
        
        # Construire le contenu — images de référence EN PREMIER
        contents = []

        # Ajouter les images de référence (sauf POV)
        # !!! NE JAMAIS remplacer "THIS person" par "same person" !!!
        # !!! Voir commentaire dans prompts/templates.py — testé 2026-02-05 !!!
        if not is_pov and image_paths:
            for img_path in image_paths[:5]:
                if Path(img_path).exists():
                    with open(img_path, "rb") as f:
                        img_data = f.read()
                    suffix = Path(img_path).suffix.lower()
                    mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(suffix, "image/png")
                    contents.append(types.Part.from_bytes(data=img_data, mime_type=mime))
                    print(f"      Ref: {Path(img_path).name}")
            contents.append("ABOVE: Reference photos of THIS person. Put THIS person into the scene below.")

        # Ajouter le prompt
        contents.append(prompt)

        # Rappel final après le prompt
        if not is_pov and image_paths:
            contents.append("CRITICAL: The output must show THIS person from the reference photos.")
        
        print(f"   [Gemini] Génération image...")
        print(f"   - Modèle: {self.model}")
        print(f"   - Références: {len(image_paths) if image_paths else 0}")
        
        # Configuration
        config = types.GenerateContentConfig(
            response_modalities=['IMAGE', 'TEXT'],
            image_config=types.ImageConfig(
                aspect_ratio="16:9"
            )
        )
        
        try:
            response = client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )
            
            # Vérifier la réponse
            if not response.candidates:
                raise ValueError("Gemini n'a pas retourné de candidats (possible safety filter)")
            
            candidate = response.candidates[0]
            
            if not candidate.content or not candidate.content.parts:
                finish_reason = getattr(candidate, 'finish_reason', None)
                raise ValueError(f"Gemini n'a pas retourné de contenu. Finish reason: {finish_reason}")
            
            # Extraire l'image
            image_data = None
            text_response = ""
            
            for part in candidate.content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_data = part.inline_data.data
                elif hasattr(part, 'text') and part.text:
                    text_response = part.text
            
            if not image_data:
                raise ValueError(f"Pas d'image dans la réponse. Texte: {text_response}")
            
            # Sauvegarder
            if output_path:
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(image_data)
            
            self.costs_real["images"] += 1
            
            print(f"   [Gemini] ✓ Image générée")
            return {"success": True, "image_path": output_path, "text_response": text_response}
            
        except Exception as e:
            print(f"   [Gemini] ❌ {e}")
            return {"success": False, "error": str(e)}
    
    def generate_switch(
        self,
        source_image: str,
        prompt: str,
        output_path: str,
    ) -> Dict:
        """Génère l'image switchée via Gemini (background swap).

        Envoie l'image source + prompt de modification du décor.
        Le prompt dit: "Keep EXACTLY the same person, change ONLY the environment."
        """
        if self.verbose:
            print(f"\n--- PROMPT SWITCH ---\n{prompt}\n---")

        if self.dry_run:
            return self._mock_generate(output_path)

        return self._call_gemini_switch(prompt, source_image, output_path)

    def _call_gemini_switch(self, prompt: str, source_image: str, output_path: str) -> Dict:
        """Appel Gemini pour le switch (source image + prompt de modification)."""

        try:
            from google.genai import types
        except ImportError:
            raise ImportError("Installez le SDK: pip install google-genai")

        client = self._get_client()

        contents = []

        # Image source en premier
        if Path(source_image).exists():
            with open(source_image, "rb") as f:
                img_data = f.read()
            suffix = Path(source_image).suffix.lower()
            mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(suffix, "image/png")
            contents.append(types.Part.from_bytes(data=img_data, mime_type=mime))
            print(f"      Source: {Path(source_image).name}")
        else:
            return {"success": False, "error": f"Source image not found: {source_image}"}

        contents.append("ABOVE: Source image. Put THIS person into the new environment. Keep exactly the same face, hair, clothes, pose, expression, and body position.")
        contents.append(prompt)
        contents.append(
            "CRITICAL: THIS person from the source image. "
            "ONLY the environment changes. Everything about the person stays identical."
        )

        print(f"   [Gemini] Switch image generation...")
        print(f"   - Modèle: {self.model}")

        config = types.GenerateContentConfig(
            response_modalities=['IMAGE', 'TEXT'],
            image_config=types.ImageConfig(
                aspect_ratio="16:9"
            )
        )

        try:
            response = client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )

            if not response.candidates:
                raise ValueError("Gemini n'a pas retourné de candidats (possible safety filter)")

            candidate = response.candidates[0]
            if not candidate.content or not candidate.content.parts:
                finish_reason = getattr(candidate, 'finish_reason', None)
                raise ValueError(f"Gemini n'a pas retourné de contenu. Finish reason: {finish_reason}")

            image_data = None
            text_response = ""

            for part in candidate.content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_data = part.inline_data.data
                elif hasattr(part, 'text') and part.text:
                    text_response = part.text

            if not image_data:
                raise ValueError(f"Pas d'image dans la réponse. Texte: {text_response}")

            if output_path:
                Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(image_data)

            self.costs_real["images"] += 1
            print(f"   [Gemini] ✓ Switch image generated")
            return {"success": True, "image_path": output_path, "text_response": text_response}

        except Exception as e:
            print(f"   [Gemini] ❌ {e}")
            return {"success": False, "error": str(e)}

    def generate_pose_edit(
        self,
        source_image: str,
        new_pose: str,
        new_expression: str,
        new_gaze: str,
        output_path: str,
        extra_instructions: str = "",
    ) -> Dict:
        """Modifie UNIQUEMENT la pose/expression du personnage, garde le fond identique.

        Utilisé quand start et end doivent avoir le MÊME décor (ex: scènes D, E).
        """
        prompt = (
            f"Modify ONLY the character in this image. "
            f"Keep the EXACT SAME background, environment, lighting, and camera angle. "
            f"DO NOT change, move, or regenerate any background element.\n\n"
            f"Change the character to:\n"
            f"- Pose: {new_pose}\n"
            f"- Expression: {new_expression}\n"
            f"- Gaze: {new_gaze}\n"
            f"{extra_instructions}\n\n"
            f"CRITICAL RULES:\n"
            f"- Same person, same face, same clothes, same hair\n"
            f"- Background MUST be pixel-identical to the source image\n"
            f"- Only the character's body position, facial expression, and gaze direction change\n"
            f"- Photorealistic quality, cinematic lighting"
        )

        if self.verbose:
            print(f"\n--- PROMPT POSE EDIT ---\n{prompt}\n---")

        if self.dry_run:
            return self._mock_generate(output_path)

        return self._call_gemini_switch(prompt, source_image, output_path)

    def _mock_generate(self, output_path: Optional[str]) -> Dict:
        print(f"   [DRY RUN] Image simulée")
        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            # 1x1 pixel PNG
            placeholder = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
            with open(output_path, "wb") as f:
                f.write(placeholder)
        return {"success": True, "image_path": output_path, "mock": True}
    
    def get_real_cost(self) -> float:
        # Gemini flash = gratuit, Gemini 3 Pro = ~0.18€/image
        if "flash" in self.model.lower():
            return 0.0
        return self.costs_real["images"] * 0.18