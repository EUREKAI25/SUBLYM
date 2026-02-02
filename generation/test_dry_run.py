#!/usr/bin/env python3
"""
Sublym v4 - Test Dry Run
Vérifie que le pipeline s'exécute sans erreur (aucun appel API).
"""

import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pipeline import DreamPipeline
from config.settings import PRESETS, DEFAULT_CONFIG


def run_dry_test():
    """Test complet du pipeline en dry_run."""

    # Créer des photos factices
    tmp_dir = Path(tempfile.mkdtemp(prefix="sublym_test_"))
    photos_dir = tmp_dir / "photos"
    photos_dir.mkdir()
    output_dir = tmp_dir / "output"

    # Créer 3 fausses photos (1x1 PNG)
    import base64
    pixel_png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    fake_photos = []
    for i in range(3):
        p = photos_dir / f"photo_{i+1}.png"
        p.write_bytes(pixel_png)
        fake_photos.append(str(p))

    dream = "Je rêve de vivre au bord de la mer, dans une maison lumineuse avec une terrasse face à l'océan."

    # Config complète basée sur DEFAULT_CONFIG
    config = dict(DEFAULT_CONFIG)
    config.update({
        "nb_scenes": 3,
        "nb_pov_scenes": 1,
        "mode": "scenario",
        "prompt_strict_prefix": "TEST PREFIX",
        "prompt_strict_suffix": "TEST SUFFIX",
    })

    print("=" * 70)
    print("TEST DRY RUN - Sublym v4")
    print("=" * 70)
    print(f"Photos: {len(fake_photos)}")
    print(f"Config keys: {len(config)}")
    print(f"Output: {output_dir}")
    print()

    # Test 1: Pipeline full
    print("\n>>> TEST 1: Pipeline FULL (dry_run)")
    pipeline = DreamPipeline(
        output_dir=str(output_dir),
        dry_run=True,
        verbose=False,
        config=config
    )

    results = pipeline.run(
        steps=dict(PRESETS["full"]),
        dream_statement=dream,
        user_photos=fake_photos,
        character_name="TestUser",
        character_gender="female",
    )

    assert results.get("success"), f"Pipeline full failed: {results.get('errors')}"
    assert "analyze_character" in results["steps_executed"]
    assert "extract_dream_elements" in results["steps_executed"]
    assert "generate_palette" in results["steps_executed"]
    assert "generate_scenario" in results["steps_executed"]
    assert "generate_scenes" in results["steps_executed"]
    assert "generate_keyframes" in results["steps_executed"]
    assert "generate_videos" in results["steps_executed"]
    print("   PASS - Toutes les étapes exécutées")

    # Vérifier les coûts
    assert "costs_real" in results
    assert all(v == 0 for v in results["costs_real"].values()), "Dry run devrait avoir coûts = 0"
    print("   PASS - Coûts = 0 (dry_run)")

    # Test 2: Pipeline scenario_only
    print("\n>>> TEST 2: Pipeline SCENARIO_ONLY (dry_run)")
    pipeline2 = DreamPipeline(
        output_dir=str(output_dir / "test2"),
        dry_run=True,
        verbose=False,
        config=config
    )

    results2 = pipeline2.run(
        steps=dict(PRESETS["scenario_only"]),
        dream_statement=dream,
        user_photos=fake_photos,
        character_name="TestUser",
        character_gender="male",
    )

    assert results2.get("success"), f"Pipeline scenario_only failed: {results2.get('errors')}"
    assert "generate_keyframes" not in results2["steps_executed"]
    assert "generate_videos" not in results2["steps_executed"]
    print("   PASS - Étapes keyframes/vidéos non exécutées")

    # Test 3: Mode free_scenes
    print("\n>>> TEST 3: Mode FREE_SCENES (dry_run)")
    config_free = dict(config)
    config_free["mode"] = "free_scenes"

    pipeline3 = DreamPipeline(
        output_dir=str(output_dir / "test3"),
        dry_run=True,
        verbose=False,
        config=config_free
    )

    results3 = pipeline3.run(
        steps=dict(PRESETS["scenario_only"]),
        dream_statement=dream,
        user_photos=fake_photos,
        character_name="TestUser",
        character_gender="female",
    )

    assert results3.get("success"), f"Pipeline free_scenes failed: {results3.get('errors')}"
    print("   PASS - Mode free_scenes OK")

    # Nettoyage
    shutil.rmtree(tmp_dir, ignore_errors=True)

    print("\n" + "=" * 70)
    print("TOUS LES TESTS PASSENT")
    print("=" * 70)
    return True


if __name__ == "__main__":
    try:
        success = run_dry_test()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n ÉCHEC: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
