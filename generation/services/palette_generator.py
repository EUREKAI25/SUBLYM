"""
Sublym v4 - Palette Generator
VERSION MISE À JOUR - Février 2026
- Palette 100% inspirée du rêve (plus de complémentarité peau)
- Style déduit de la photo du personnage
"""

import json
import re
import urllib.request
from typing import Dict, List, Any, Optional

from .env_loader import get_api_key
from config.settings import DEFAULT_MODELS
from prompts.templates import PROMPT_GENERATE_PALETTE, PROMPT_SCENE_PALETTE


class PaletteGenerator:
    """Génère les palettes via LLM."""

    def __init__(self, config: Dict, dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.model = config.get("models", {}).get("scenario", DEFAULT_MODELS["scenario"])
        self.strict_prefix = config.get("prompt_strict_prefix", "")
        self.strict_suffix = config.get("prompt_strict_suffix", "")
        
        # Tracking coûts
        self.costs_real = {"tokens_input": 0, "tokens_output": 0, "calls": 0}
    
    def generate_main_palette(
        self,
        dream_statement: str,
        style_description: str = "classique",
        mood_keywords: List[str] = None,
        custom_palette: Optional[List[str]] = None,
        # Anciens paramètres pour rétrocompatibilité
        skin_tone: str = None,
        hair_color: str = None
    ) -> Dict[str, Any]:
        """
        Génère la palette principale (4 couleurs hex).
        
        Args:
            dream_statement: Description du rêve
            style_description: Style vestimentaire déduit (classique, créatif, etc.)
            mood_keywords: Mots-clés d'ambiance extraits du rêve
            custom_palette: Palette personnalisée (bypass génération)
        """
        
        print("\n" + "=" * 60)
        print("ÉTAPE 2: PALETTE COULEURS")
        print("=" * 60)
        
        if custom_palette and len(custom_palette) == 4:
            print(f"  🎨 Palette personnalisée: {custom_palette}")
            return {
                "main_palette": custom_palette,
                "palette_names": ["custom"] * 4,
                "mood": "custom",
                "reasoning": "Palette fournie par l'utilisateur"
            }
        
        # Formater les mots-clés
        mood_str = ", ".join(mood_keywords) if mood_keywords else "non spécifié"
        
        prompt = PROMPT_GENERATE_PALETTE.format(
            strict_prefix=self.strict_prefix,
            dream_statement=dream_statement,
            style_description=style_description,
            mood_keywords=mood_str,
            strict_suffix=self.strict_suffix
        )
        
        if self.verbose:
            print(f"\n--- PROMPT PALETTE ---\n{prompt}\n---")
        
        if self.dry_run:
            print("  [DRY RUN] Palette simulée")
            return self._mock_palette()
        
        response = self._call_openai(prompt)
        palette = self._parse_json(response)
        
        print(f"  🎨 Générée: {palette.get('main_palette', [])}")
        print(f"  🎭 Mood: {palette.get('mood', 'N/A')}")
        if self.verbose and palette.get('reasoning'):
            print(f"  💡 Raison: {palette.get('reasoning', '')[:100]}...")
        
        return palette
    
    def generate_scene_palette(
        self,
        main_palette: List[str],
        mood: str,
        time_of_day: str,
        indoor: bool,
        atmosphere: str = ""
    ) -> Dict[str, Any]:
        """Décline la palette pour une scène spécifique."""
        
        if self.dry_run:
            return {
                "scene_palette": main_palette,
                "lighting_mood": f"{time_of_day} mood",
                "color_temperature": "warm" if "golden" in time_of_day or "sunset" in time_of_day else "neutral"
            }
        
        prompt = PROMPT_SCENE_PALETTE.format(
            strict_prefix=self.strict_prefix,
            main_palette=", ".join(main_palette),
            mood=mood,
            time_of_day=time_of_day,
            indoor_outdoor="intérieur" if indoor else "extérieur",
            atmosphere=atmosphere or mood,
            strict_suffix=self.strict_suffix
        )
        
        if self.verbose:
            print(f"\n--- PROMPT SCENE_PALETTE ---\n{prompt}\n---")
        
        response = self._call_openai(prompt)
        return self._parse_json(response)
    
    def _call_openai(self, prompt: str) -> str:
        api_key = get_api_key("OPENAI_API_KEY")
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
        
        # Track usage réel
        usage = result.get("usage", {})
        self.costs_real["tokens_input"] += usage.get("prompt_tokens", 0)
        self.costs_real["tokens_output"] += usage.get("completion_tokens", 0)
        self.costs_real["calls"] += 1
        
        return result["choices"][0]["message"]["content"]
    
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
        return {"main_palette": ["#E8D5B7", "#87CEEB", "#F5F5DC", "#2F4F4F"], "mood": "default"}
    
    def _mock_palette(self) -> Dict:
        return {
            "main_palette": ["#E8D5B7", "#87CEEB", "#F5F5DC", "#2F4F4F"],
            "palette_names": ["Warm Sand", "Sky Blue", "Soft Cream", "Deep Teal"],
            "mood": "serene, creative, dynamic",
            "reasoning": "Mock palette for dry run"
        }
    
    def get_real_cost(self) -> float:
        """Coût réel OpenAI."""
        # GPT-4o pricing
        input_cost = (self.costs_real["tokens_input"] / 1000) * 0.005
        output_cost = (self.costs_real["tokens_output"] / 1000) * 0.015
        return input_cost + output_cost
