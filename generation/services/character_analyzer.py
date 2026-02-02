"""
Sublym v4 - Character Analyzer
Analyse les photos pour extraire les caractéristiques du personnage
"""

import json
import base64
import re
from typing import Dict, List, Any
from pathlib import Path

from .env_loader import get_api_key
from config.settings import DEFAULT_MODELS
from prompts.templates import PROMPT_ANALYZE_CHARACTER


class CharacterAnalyzer:
    """Analyse les photos via Gemini Vision."""

    def __init__(self, config: Dict, dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.model = config.get("models", {}).get("vision", DEFAULT_MODELS["vision"])
        
        # Tracking coûts réels
        self.costs_real = {"tokens_input": 0, "tokens_output": 0, "calls": 0}
    
    def analyze(self, photo_paths: List[str]) -> Dict[str, Any]:
        """Analyse toutes les photos et consolide."""
        print("\n" + "=" * 60)
        print("ÉTAPE 1: ANALYSE PERSONNAGE")
        print("=" * 60)
        print(f"  📷 {len(photo_paths)} photos")
        
        if self.dry_run:
            print("  [DRY RUN] Analyse simulée")
            if self.verbose:
                print(f"\n--- PROMPT ---\n{PROMPT_ANALYZE_CHARACTER}\n---")
            return self._mock_analysis()
        
        analyses = []
        for i, photo in enumerate(photo_paths):
            print(f"\n  [{i+1}/{len(photo_paths)}] {Path(photo).name}")
            analysis = self._analyze_single(photo)
            if analysis:
                analyses.append(analysis)
                print(f"    ✓ Âge: {analysis.get('age_estimate', 'N/A')}")
        
        consolidated = self._consolidate(analyses)
        
        print(f"\n  📊 CONSOLIDÉ: âge={consolidated.get('age_estimate')}, "
              f"corpulence={consolidated.get('body', {}).get('type')}")
        
        return consolidated
    
    def _analyze_single(self, photo_path: str) -> Dict:
        import urllib.request
        
        api_key = get_api_key("GEMINI_API_KEY")
        
        with open(photo_path, "rb") as f:
            img_data = base64.b64encode(f.read()).decode("utf-8")
        
        suffix = Path(photo_path).suffix.lower()
        mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(suffix, "image/png")
        
        payload = {
            "contents": [{"parts": [
                {"inline_data": {"mime_type": mime, "data": img_data}},
                {"text": PROMPT_ANALYZE_CHARACTER}
            ]}],
            "generationConfig": {"temperature": 0.2}
        }
        
        if self.verbose:
            print(f"\n--- PROMPT ---\n{PROMPT_ANALYZE_CHARACTER}\n---")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={api_key}"
        
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
        
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.loads(response.read().decode("utf-8"))
            
            # Track usage
            usage = result.get("usageMetadata", {})
            self.costs_real["tokens_input"] += usage.get("promptTokenCount", 0)
            self.costs_real["tokens_output"] += usage.get("candidatesTokenCount", 0)
            self.costs_real["calls"] += 1
            
            text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return self._parse_json(text)
        except Exception as e:
            print(f"    ❌ {e}")
            return {}
    
    def _consolidate(self, analyses: List[Dict]) -> Dict:
        if not analyses:
            return {}
        if len(analyses) == 1:
            return analyses[0]
        
        # Âge max
        ages = [a.get("age_estimate", 0) for a in analyses if a.get("age_estimate")]
        max_age = max(ages) if ages else None
        
        # Lunettes: si sur une photo, on garde
        has_glasses = any(a.get("glasses", {}).get("present") for a in analyses)
        glasses_info = next((a.get("glasses") for a in analyses if a.get("glasses", {}).get("present")), {"present": False})
        
        # Union accessoires et signes distinctifs
        all_accessories = []
        all_distinctive = []
        for a in analyses:
            all_accessories.extend(a.get("accessories", []))
            all_distinctive.extend(a.get("distinctive_features", []))
        
        consolidated = analyses[0].copy()
        consolidated["age_estimate"] = max_age
        consolidated["glasses"] = glasses_info
        consolidated["accessories"] = all_accessories
        consolidated["distinctive_features"] = list(set(all_distinctive))
        
        return consolidated
    
    def _parse_json(self, text: str) -> Dict:
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
        return {}
    
    def _mock_analysis(self) -> Dict:
        return {
            "age_estimate": 45,
            "face": {"shape": "oval", "features": "natural"},
            "body": {"type": "average", "build": "medium"},
            "skin_tone": "#D4A574",
            "hair": {"color": "#5C4033", "color_name": "brown", "length": "shoulder", "type": "wavy"},
            "glasses": {"present": False},
            "accessories": [],
            "distinctive_features": []
        }
    
    def format_for_prompt(self, analysis: Dict) -> str:
        """Formate l'analyse COMPLÈTE pour un prompt."""
        lines = []
        if analysis.get("age_estimate"):
            lines.append(f"- Age: approximately {analysis['age_estimate']} years old")
        face = analysis.get("face", {})
        if face:
            lines.append(f"- Face shape: {face.get('shape', 'N/A')}")
            lines.append(f"- Distinctive facial features: {face.get('features', 'N/A')}")
        body = analysis.get("body", {})
        if body:
            lines.append(f"- Body type: {body.get('type', 'N/A')} / {body.get('build', 'N/A')}")
        hair = analysis.get("hair", {})
        if hair:
            lines.append(f"- Hair: {hair.get('color_name', 'N/A')}, {hair.get('length', 'N/A')}, {hair.get('type', 'N/A')}")
        if analysis.get("skin_tone"):
            lines.append(f"- Skin tone: {analysis['skin_tone']}")
        glasses = analysis.get("glasses", {})
        if glasses.get("present"):
            lines.append(f"- Glasses: YES - {glasses.get('frame_style', 'present')} ({glasses.get('frame_color', '')})")
        else:
            lines.append("- Glasses: NO - character does NOT wear glasses")
        accessories = analysis.get("accessories", [])
        if accessories:
            acc_str = ", ".join(a.get("type", "") for a in accessories if isinstance(a, dict))
            lines.append(f"- Accessories from reference: {acc_str}")
        else:
            lines.append("- Accessories: NONE visible in reference photos")
        distinctive = analysis.get("distinctive_features", [])
        if distinctive:
            lines.append(f"- Distinctive marks: {', '.join(distinctive)}")
        return "\n".join(lines)
    
    def get_real_cost(self) -> float:
        """Calcule le coût réel basé sur les tokens."""
        # Gemini pricing approximatif
        input_cost = (self.costs_real["tokens_input"] / 1000) * 0.00025
        output_cost = (self.costs_real["tokens_output"] / 1000) * 0.0005
        return input_cost + output_cost
