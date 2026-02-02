"""
Sublym v4 - Dream Analyzer
NOUVEAU: Extrait et priorise les éléments du rêve (Étape 0)
"""

import json
import re
import urllib.request
from typing import Dict, List, Any

from .env_loader import get_api_key
from config.settings import DEFAULT_MODELS
from prompts.templates import PROMPT_EXTRACT_DREAM_ELEMENTS


class DreamAnalyzer:
    """Analyse le rêve et extrait les éléments clés."""

    def __init__(self, config: Dict, dry_run: bool = False, verbose: bool = False):
        self.config = config
        self.dry_run = dry_run
        self.verbose = verbose
        self.model = config.get("models", {}).get("scenario", DEFAULT_MODELS["scenario"])
        self.strict_prefix = config.get("prompt_strict_prefix", "")
        self.strict_suffix = config.get("prompt_strict_suffix", "")
        
        self.costs_real = {"tokens_input": 0, "tokens_output": 0, "calls": 0}
    
    def extract_elements(
        self,
        dream_statement: str,
        character_name: str,
        character_gender: str,
        age: int,
        style_description: str = "classique"
    ) -> Dict[str, Any]:
        """Extrait les éléments du rêve."""
        
        print("\n" + "=" * 60)
        print("ÉTAPE 0: EXTRACTION ÉLÉMENTS DU RÊVE")
        print("=" * 60)
        
        prompt = PROMPT_EXTRACT_DREAM_ELEMENTS.format(
            strict_prefix=self.strict_prefix,
            dream_statement=dream_statement,
            character_name=character_name,
            character_gender=character_gender,
            age=age,
            style_description=style_description,
            strict_suffix=self.strict_suffix
        )
        
        if self.verbose:
            print(f"\n--- PROMPT EXTRACT_DREAM ---\n{prompt}\n---")
        
        if self.dry_run:
            print("  [DRY RUN] Éléments simulés")
            return self._mock_elements(dream_statement)
        
        response = self._call_openai(prompt)
        elements = self._parse_json(response)
        
        print(f"  ✓ Éléments explicites: {len(elements.get('user_explicit_elements', []))}")
        print(f"  ✓ Moments suggérés: {len(elements.get('suggested_moments', []))}")
        print(f"  ✓ Character B: {'Oui' if elements.get('character_b', {}).get('present') else 'Non'}")
        
        return elements
    
    def _call_openai(self, prompt: str) -> str:
        api_key = get_api_key("OPENAI_API_KEY")
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
        
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
        return self._mock_elements("")
    
    def _mock_elements(self, dream: str) -> Dict:
        return {
            "user_explicit_elements": ["élément 1", "élément 2"],
            "user_implicit_desires": ["désir 1"],
            "suggested_moments": [
                {
                    "moment": "Moment d'action",
                    "priority": 1,
                    "type": "ACTION",
                    "dream_element_illustrated": "élément 1"
                },
                {
                    "moment": "Moment d'accomplissement",
                    "priority": 1,
                    "type": "ACCOMPLISSEMENT",
                    "dream_element_illustrated": "élément 2"
                }
            ],
            "character_b": {
                "present": False,
                "importance": "none",
                "role": None,
                "appearance_hints": None,
                "min_scenes_ratio": 0
            },
            "iconic_elements": [],
            "mood_keywords": ["serein", "lumineux"],
            "must_avoid": ["clichés touristiques"]
        }
    
    def get_real_cost(self) -> float:
        input_cost = (self.costs_real["tokens_input"] / 1000) * 0.005
        output_cost = (self.costs_real["tokens_output"] / 1000) * 0.015
        return input_cost + output_cost
