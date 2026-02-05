#!/usr/bin/env python3
"""
Test d'estimation de cout - Scenario Agent v7
Lance UNIQUEMENT la generation de scenario (pas d'images/videos).
Mesure les couts reels: generation (GPT-4o) vs validation (GPT-4o-mini).
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config.settings import DEFAULT_CONFIG
from services.scenario_generator import ScenarioGenerator

# =============================================================================
# CONFIGURATION DU TEST
# =============================================================================

CLAIRE_DIR = Path(__file__).resolve().parent.parent.parent / "SUBLYM_APP_PUB" / "Avatars" / "Claire48" / "Claire"
DREAM_FILE = CLAIRE_DIR / "dream.txt"

DREAM_STATEMENT = DREAM_FILE.read_text(encoding="utf-8").strip().strip('"')
CHARACTER_NAME = "Claire"
CHARACTER_GENDER = "female"
AGE = 48
NB_SCENES = 4
DUREE_SCENE = 6

OUTPUT_DIR = Path("/tmp/sublym_cost_test_v7")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 70)
print("SUBLYM v7 - TEST ESTIMATION COUT")
print("=" * 70)
print(f"Personnage: {CHARACTER_NAME} ({CHARACTER_GENDER}, {AGE} ans)")
print(f"Reve: {DREAM_STATEMENT}")
print(f"Scenes: {NB_SCENES} x {DUREE_SCENE}s")
print(f"Modele generation: {DEFAULT_CONFIG['models']['scenario']}")
print(f"Modele validation: {DEFAULT_CONFIG['models']['scenario_validation']}")
print("=" * 70)

# =============================================================================
# LANCEMENT
# =============================================================================

config = {
    **DEFAULT_CONFIG,
    "validation": {
        "enable_v1": True,
        "enable_v2": True,
        "enable_v3": True,
        "score_min_pass": 0.8,
    },
    "llm": {
        "max_retries": 3,
        "timeout": 120,
        "temperature_generation": 0.7,
        "temperature_validation": 0.2,
    },
}

gen = ScenarioGenerator(config, dry_run=False, verbose=False)

start = time.time()

try:
    result = gen.generate_v7(
        dream_statement=DREAM_STATEMENT,
        character_name=CHARACTER_NAME,
        character_gender=CHARACTER_GENDER,
        age=AGE,
        nb_scenes=NB_SCENES,
        duree_scene=DUREE_SCENE,
        dream_elements={
            "user_explicit_elements": ["Africa", "concret", "calm", "aligned"],
            "user_implicit_desires": ["connexion", "engagement humanitaire", "nature"],
            "mood_keywords": ["serenite", "accomplissement", "authenticite"],
            "character_b": {"present": False},
        },
        style_description="decontracte, naturel",
        reject=None,
    )
except Exception as e:
    print(f"\n!!! ERREUR: {e}")
    import traceback
    traceback.print_exc()
    result = {}

elapsed = time.time() - start

# =============================================================================
# RESULTATS
# =============================================================================

print("\n" + "=" * 70)
print("RESULTATS DU TEST")
print("=" * 70)

breakdown = gen.get_cost_breakdown()

print(f"\nDuree totale: {elapsed:.1f}s")
print(f"\n--- GENERATION ({breakdown['generation']['model']}) ---")
print(f"  Appels LLM: {breakdown['generation']['calls']}")
print(f"  Tokens: {breakdown['generation']['tokens']:,}")
print(f"  Cout: ${breakdown['generation']['cost_usd']:.4f}")

print(f"\n--- VALIDATION ({breakdown['validation']['model']}) ---")
print(f"  Appels LLM: {breakdown['validation']['calls']}")
print(f"  Tokens: {breakdown['validation']['tokens']:,}")
print(f"  Cout: ${breakdown['validation']['cost_usd']:.4f}")

print(f"\n--- TOTAL ---")
print(f"  Appels LLM: {gen.costs_real['calls']}")
print(f"  Tokens: {gen.costs_real['tokens_input'] + gen.costs_real['tokens_output']:,}")
print(f"  Cout total: ${breakdown['total_usd']:.4f}")
print(f"  Cout EUR (~): {breakdown['total_usd'] * 0.92:.4f} EUR")

# Estimation du cout avec l'ancien modele (tout en GPT-4o)
costs = config.get("costs", {})
old_cost_in = (gen.costs_real["tokens_input"] / 1000) * costs.get("scenario_input_per_1k", 0.005)
old_cost_out = (gen.costs_real["tokens_output"] / 1000) * costs.get("scenario_output_per_1k", 0.015)
old_total = old_cost_in + old_cost_out

print(f"\n--- COMPARAISON ---")
print(f"  Ancien cout (tout GPT-4o): ${old_total:.4f}")
print(f"  Nouveau cout (GPT-4o + mini): ${breakdown['total_usd']:.4f}")
print(f"  Economie: ${old_total - breakdown['total_usd']:.4f} ({(1 - breakdown['total_usd']/old_total)*100:.0f}%)")

# Sauvegarder les resultats
output_data = {
    "dream": DREAM_STATEMENT,
    "character": CHARACTER_NAME,
    "nb_scenes": NB_SCENES,
    "duration_seconds": elapsed,
    "cost_breakdown": breakdown,
    "old_cost_all_gpt4o": old_total,
    "savings_percent": (1 - breakdown['total_usd']/old_total)*100 if old_total > 0 else 0,
    "generation_calls": gen.costs_generation,
    "validation_calls": gen.costs_validation,
    "total_calls": gen.costs_real,
}

with open(OUTPUT_DIR / "cost_test_result.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

# Sauvegarder le scenario complet
with open(OUTPUT_DIR / "scenario_v7.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, ensure_ascii=False, default=str)

# Sauvegarder l'audit log
gen.audit.save(str(OUTPUT_DIR / "audit_log.txt"))

print(f"\nFichiers sauvegardes dans: {OUTPUT_DIR}")
print("  - cost_test_result.json")
print("  - scenario_v7.json")
print("  - audit_log.txt")
