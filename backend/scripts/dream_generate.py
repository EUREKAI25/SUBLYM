#!/usr/bin/env python3
"""
Sublym v4 - Bridge script
Called by the TypeScript backend (generation.ts) via subprocess.
Bridges CLI arguments to the DreamPipeline.

Usage (from backend):
    python dream_generate.py \
        --dream "Description du rêve" \
        --photos "/path/photo1.jpg,/path/photo2.jpg" \
        --trace-id "abc123" \
        --output-dir "/storage/users/1/dreams/1" \
        --scenes-count 5 \
        --keyframes-count 5 \
        [--character-name "Julien"] \
        [--character-gender "male"] \
        [--reject "element1,element2"] \
        [--subliminal "texte subliminal"] \
        [--photos-only]
"""

import argparse
import json
import sys
import os
from pathlib import Path

# Add the generation module to path
GENERATION_DIR = Path(__file__).resolve().parent.parent.parent / "generation"
sys.path.insert(0, str(GENERATION_DIR))

from pipeline import DreamPipeline
from config.settings import PRESETS, DEFAULT_CONFIG, DEFAULT_MODELS, SCENE_TYPES
import config.settings as settings_module
import prompts.templates as templates_module


def emit_progress(progress: int, step: str, message: str):
    """Emit a JSON progress line to stdout for the backend to parse."""
    print(json.dumps({
        "progress": progress,
        "step": step,
        "message": message,
    }), flush=True)


def main():
    parser = argparse.ArgumentParser(description="Sublym dream generation")
    parser.add_argument("--dream", required=True, help="Dream description")
    parser.add_argument("--photos", required=True, help="Comma-separated photo paths")
    parser.add_argument("--trace-id", required=True, help="Run trace ID")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--scenes-count", type=int, default=4, help="Number of scenes")
    parser.add_argument("--keyframes-count", type=int, default=4, help="Number of keyframes")
    parser.add_argument("--character-name", default="User", help="Character first name")
    parser.add_argument("--character-gender", default="neutral", help="Character gender (male/female/neutral)")
    parser.add_argument("--reject", default="", help="Comma-separated reject list")
    parser.add_argument("--subliminal", default="", help="Subliminal text")
    parser.add_argument("--photos-only", action="store_true", help="Generate keyframes only, no video")
    parser.add_argument("--mode", default="scenario", help="Generation mode (scenario/free_scenes/scenario_pub)")
    parser.add_argument("--daily-context", default="", help="Daily context for scenario_pub mode")
    args = parser.parse_args()

    # Parse photo paths
    photo_paths = [p.strip() for p in args.photos.split(",") if p.strip()]
    valid_photos = [p for p in photo_paths if Path(p).exists()]

    if not valid_photos:
        print(json.dumps({"error": "No valid photos found"}), flush=True)
        sys.exit(1)

    output_dir = Path(args.output_dir)

    # Determine steps based on mode and photos-only flag
    if args.mode == "scenario_pub":
        steps = PRESETS["scenario_pub"].copy()
    elif args.photos_only:
        steps = PRESETS["keyframes_only"].copy()
    else:
        steps = PRESETS["full"].copy()

    # Number of POV scenes (1 for 4+ scenes, 0 otherwise)
    nb_pov = 1 if args.scenes_count >= 4 else 0

    emit_progress(5, "initializing", "Initialisation du pipeline...")

    # Build config from defaults + overrides from backoffice
    config = dict(DEFAULT_CONFIG)
    config["nb_scenes"] = args.scenes_count
    config["nb_pov_scenes"] = nb_pov
    config["mode"] = args.mode
    if args.daily_context:
        config["daily_context"] = args.daily_context

    # Read dynamic config from backend (written as generation_config.json)
    gen_config_file = output_dir / "generation_config.json"
    if gen_config_file.exists():
        with open(gen_config_file, encoding="utf-8") as f:
            gen_config = json.load(f)
        config["max_attempts"] = gen_config.get("max_attempts", config.get("max_attempts", 5))
        config["max_video_attempts"] = gen_config.get("max_video_attempts", config.get("max_video_attempts", 4))
        config["models"] = {
            "scenario": gen_config.get("model_scenario", DEFAULT_MODELS["scenario"]),
            "image": gen_config.get("model_image", DEFAULT_MODELS["image"]),
            "vision": DEFAULT_MODELS["vision"],
            "video": gen_config.get("model_video", DEFAULT_MODELS["video"]),
        }
        # Scene types from database (overrides hardcoded SCENE_TYPES)
        if "scene_types" in gen_config:
            config["scene_types"] = gen_config["scene_types"]
            # Patch the settings module so services importing SCENE_TYPES get DB values
            settings_module.SCENE_TYPES = gen_config["scene_types"]

        # Prompt templates from database (overrides hardcoded PROMPT_*)
        if "prompts" in gen_config:
            config["prompts"] = gen_config["prompts"]
            # Patch the templates module so services importing PROMPT_* get DB values
            for code, template in gen_config["prompts"].items():
                attr_name = f"PROMPT_{code}"
                if hasattr(templates_module, attr_name):
                    setattr(templates_module, attr_name, template)

    # Create pipeline with progress callback
    pipeline = DreamPipeline(
        output_dir=str(output_dir.parent),
        dry_run=False,
        verbose=False,
        config=config,
        on_progress=emit_progress,
    )

    # Override run_dir to use the exact output dir the backend expects
    pipeline.run_dir = output_dir
    pipeline._dirs_created = False

    # Parse reject list
    reject = [r.strip() for r in args.reject.split(",") if r.strip()] if args.reject else None

    # Run pipeline
    results = pipeline.run(
        steps=steps,
        dream_statement=args.dream,
        user_photos=valid_photos,
        character_name=args.character_name,
        character_gender=args.character_gender,
        reject=reject,
        daily_context=args.daily_context,
    )

    # Write result.json in the format the backend expects
    result_data = {
        "success": results.get("success", False),
        "scenarioName": results.get("scenario_name", args.dream[:50]),
        "scenesCount": results.get("scenes_count", args.scenes_count),
        "duration": results.get("total_duration", args.scenes_count * 6),
        "costEur": sum(results.get("costs_real", {}).values()),
        "costDetails": results.get("costs_real", {}),
        "errors": results.get("errors", []),
    }

    result_file = output_dir / "result.json"
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False, default=str)

    if results.get("success"):
        emit_progress(100, "completed", "Génération terminée!")
        sys.exit(0)
    else:
        emit_progress(100, "failed", f"Échec: {results.get('errors', ['Unknown error'])}")
        sys.exit(1)


if __name__ == "__main__":
    main()
