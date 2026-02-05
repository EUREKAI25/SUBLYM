"""
Sublym v4 - Dream Pipeline
VERSION v7 - Février 2026
- Scenario Agent v7: 11 étapes avec triple validation (mode scenario)
- Prompts vidéo générés directement en anglais (step 11)
- Validation V1/V2/V3 sur modèle économique (GPT-4o-mini)
- Retry sur échec vidéo (max 4 tentatives)
- Validation de complétude avant montage
- Échec global si vidéos manquantes
- Nommage répertoire avec titre du rêve
- Pas de création de répertoire vide si erreur précoce
- Étape 0: extraction éléments du rêve
"""

import json
import random
import shutil
import time
import uuid
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime

from services import (
    CharacterAnalyzer, PaletteGenerator, ScenarioGenerator,
    ImageGenerator, ImageValidator, VideoGenerator, VideoMontage,
    DreamAnalyzer  # NOUVEAU
)


class DreamPipeline:
    """Pipeline modulaire."""

    MAX_VIDEO_ATTEMPTS = 4

    def __init__(self, output_dir: str, dry_run: bool = False, verbose: bool = False, config: Dict = None,
                 on_progress: Any = None):
        self.output_dir = Path(output_dir)
        self.dry_run = dry_run
        self.verbose = verbose
        self.config = config or {}
        self.on_progress = on_progress  # Callback: (progress_pct, step_name, message)
        
        self.dream_analyzer = DreamAnalyzer(config, dry_run, verbose)  # NOUVEAU
        self.analyzer = CharacterAnalyzer(config, dry_run, verbose)
        self.palette_gen = PaletteGenerator(config, dry_run, verbose)
        self.scenario_gen = ScenarioGenerator(config, dry_run, verbose)
        self.image_gen = ImageGenerator(config, dry_run, verbose)
        self.validator = ImageValidator(config, dry_run, verbose)
        self.video_gen = VideoGenerator(config, str(self.output_dir / "videos_temp"), dry_run, verbose)
        self.montage = VideoMontage(verbose)
        
        self.run_id = None
        self.run_dir = None
        self._dirs_created = False  # Pour éviter les répertoires vides

    def _emit_progress(self, progress: int, step: str, message: str):
        """Emit progress if callback is set."""
        if self.on_progress:
            self.on_progress(progress, step, message)
    
    def run(self, steps: Dict[str, bool], dream_statement: str = "", user_photos: List[str] = None,
            character_name: str = "Character", character_gender: str = "female",
            keyframes_dir: str = None, videos_dir: str = None, scenario_json: str = None,
            reject: List[str] = None, daily_context: str = "") -> Dict:
        
        # Génération de l'ID de run
        self.run_id = str(uuid.uuid4())[:8]

        # Respecter run_dir si pré-défini (par le backend), sinon créer un slug
        self.dream_slug = self._slugify(dream_statement[:40]) if dream_statement else "dream"
        if self.run_dir is None:
            char_slug = self._slugify(character_name)
            self.run_dir = self.output_dir / f"{char_slug}_{self.dream_slug}_{self.run_id}"
        else:
            # Convertir en Path si c'est une string
            self.run_dir = Path(self.run_dir)
        
        # NE PAS créer les répertoires tout de suite - attendre la première opération réussie
        
        print("=" * 70)
        print("SUBLYM v4 - DREAM PIPELINE")
        print("=" * 70)
        print(f"👤 {character_name} | 📁 {self.run_dir}")
        print(f"🧪 Dry: {self.dry_run} | 📝 Verbose: {self.verbose}")
        print("=" * 70)
        
        results = {
            "run_id": self.run_id,
            "steps_executed": [],
            "success": False,
            "costs_real": {},
            "errors": [],
            "warnings": []
        }
        
        try:
            state = {
                "user_photos": user_photos or [],
                "character_analysis": None,
                "style_description": "classique",  # NOUVEAU
                "dream_elements": None,  # NOUVEAU
                "main_palette": self.config.get("custom_palette"),
                "palette_mood": "",
                "global_scenario": None,
                "video_scenarios": None,
                "scene_palettes": {},
                "keyframe_paths": {},
                "video_paths": [],
                "failed_videos": [],
            }
            
            # Load existing data
            if scenario_json and Path(scenario_json).exists():
                with open(scenario_json) as f:
                    state["global_scenario"] = json.load(f)
                # Auto-load companion files from same directory
                json_dir = Path(scenario_json).parent
                video_scenarios_path = json_dir / "scenarios_video.json"
                if video_scenarios_path.exists():
                    with open(video_scenarios_path) as f:
                        state["video_scenarios"] = json.load(f)
                    print(f"  📂 Video scenarios chargés: {video_scenarios_path}")
                palette_path = json_dir / "palette.json"
                if palette_path.exists():
                    with open(palette_path) as f:
                        pal_data = json.load(f)
                    state["scene_palettes"] = pal_data.get("scene_palettes", {})
                    state["main_palette"] = pal_data.get("main_palette")
                    print(f"  📂 Palettes chargées: {palette_path}")
                # Load switch_data for pub mode
                pub_full_path = json_dir / "scenario_pub_v7_full.json"
                if pub_full_path.exists():
                    with open(pub_full_path) as f:
                        pub_data = json.load(f)
                    state["switch_data"] = pub_data.get("switch_data", {})
                    print(f"  📂 Switch data chargé: {pub_full_path}")
            if keyframes_dir:
                state["keyframe_paths"] = self._load_keyframes(keyframes_dir)
            if videos_dir:
                state["video_paths"] = [str(p) for p in sorted(Path(videos_dir).glob("scene_*.mp4"))]
            
            nb_scenes = self.config.get("nb_scenes", 6)
            nb_pov = self.config.get("nb_pov_scenes", 1)
            mode = self.config.get("mode", "scenario")
            max_attempts = self.config.get("max_attempts", 7)
            
            # ================================================================
            # ÉTAPE 1: ANALYSE PERSONNAGE
            # ================================================================
            self._emit_progress(10, "analyze_character", "Analyse du personnage...")
            if steps.get("analyze_character") and state["user_photos"]:
                state["character_analysis"] = self.analyzer.analyze(state["user_photos"])
                
                # Déduire le style vestimentaire
                state["style_description"] = self._deduce_style(state["character_analysis"])
                
                results["steps_executed"].append("analyze_character")
                self._ensure_dirs()
                self._save_json("character_analysis.json", state["character_analysis"])
                
                # Initialiser le FaceValidator avec le run_dir
                self.validator.set_run_dir(str(self.run_dir))
            
            age = (state.get("character_analysis") or {}).get("age_estimate", 40)
            
            # ================================================================
            # ÉTAPE 0 (NOUVELLE): EXTRACTION DES ÉLÉMENTS DU RÊVE
            # ================================================================
            self._emit_progress(15, "extract_dream_elements", "Extraction des éléments du rêve...")
            if steps.get("extract_dream_elements"):
                state["dream_elements"] = self.dream_analyzer.extract_elements(
                    dream_statement=dream_statement,
                    character_name=character_name,
                    character_gender=character_gender,
                    age=age,
                    style_description=state["style_description"]
                )
                results["steps_executed"].append("extract_dream_elements")
                self._ensure_dirs()
                self._save_json("dream_elements.json", state["dream_elements"])
                
                # Afficher les éléments extraits
                print(f"\n  📋 Éléments explicites: {state['dream_elements'].get('user_explicit_elements', [])}")
                print(f"  💭 Désirs implicites: {state['dream_elements'].get('user_implicit_desires', [])}")
                if state['dream_elements'].get('character_b', {}).get('present'):
                    print(f"  👥 Character B: {state['dream_elements']['character_b'].get('role', 'présent')}")
            
            # ================================================================
            # ÉTAPES 2-4: V7 (mode scenario) OU LEGACY (pub/free_scenes)
            # ================================================================

            if mode == "scenario" and steps.get("generate_scenario"):
                # ==========================================================
                # V7 MODE: PALETTE + SCÉNARIO + SCÈNES EN UNE PASSE
                # 11 étapes avec triple validation V1/V2/V3
                # ==========================================================
                self._emit_progress(20, "generate_scenario", "Scénario v7 (11 étapes)...")

                v7_result = self.scenario_gen.generate_v7(
                    dream_statement=dream_statement,
                    character_name=character_name,
                    character_gender=character_gender,
                    age=age,
                    nb_scenes=nb_scenes,
                    duree_scene=self.config.get("duree_scene", 6),
                    dream_elements=state.get("dream_elements"),
                    character_analysis=state.get("character_analysis"),
                    style_description=state["style_description"],
                    reject=reject,
                )

                # Conversion vers format pipeline
                global_scenario, video_scenarios, scene_palettes = \
                    self.scenario_gen.convert_v7_to_pipeline(v7_result)

                state["global_scenario"] = global_scenario
                state["video_scenarios"] = video_scenarios
                state["scene_palettes"] = scene_palettes

                # Palette globale depuis v7
                pg = v7_result.get("palette_globale", {})
                if isinstance(pg, dict) and pg:
                    state["main_palette"] = [
                        pg.get("principale", "#888888"),
                        pg.get("secondaire", "#666666"),
                        pg.get("accent", "#AAAAAA"),
                        pg.get("neutre_clair", "#CCCCCC"),
                        pg.get("neutre_fonce", "#333333"),
                    ]

                results["steps_executed"].extend([
                    "generate_palette", "generate_scenario", "generate_scenes"
                ])
                self._ensure_dirs()
                self._save_json("scenario_v7_full.json", v7_result)
                self._save_json("scenario_global.json", global_scenario)
                self._save_json("scenarios_video_fr.json", video_scenarios)
                self._save_json("palette.json", {
                    "main_palette": state["main_palette"],
                    "scene_palettes": scene_palettes,
                    "palette_globale": pg,
                })

                # Audit log v7
                audit_data = self.scenario_gen.audit.get_data()
                self._save_json("scenario_v7_audit.json", audit_data)
                self.scenario_gen.audit.save(
                    str(self.run_dir / "json" / "scenario_v7_audit.txt")
                )

                # Injection des prompts EN (générés directement en anglais par step 11)
                state["video_scenarios"] = self.scenario_gen.apply_video_prompts(
                    state["video_scenarios"]
                )
                self._save_json("scenarios_video.json", state["video_scenarios"])

                # Validation couverture éléments
                if state.get("dream_elements"):
                    coverage = self._validate_elements_coverage(
                        state["dream_elements"], state["global_scenario"]
                    )
                    if coverage["coverage_ratio"] < 0.6:
                        results["warnings"].append(
                            f"Couverture éléments du rêve: "
                            f"{coverage['coverage_ratio']:.0%} (< 60%)"
                        )
                        print(f"\n  ⚠️ Couverture éléments: "
                              f"{coverage['coverage_ratio']:.0%}")
                        print(f"     Manquants: {coverage.get('missing', [])}")

            elif mode == "scenario_pub" and steps.get("generate_scenario"):
                # ==========================================================
                # PUB V7 MODE: QUOTIDIEN → SWITCH → DÉCOUVERTE → RÊVE
                # ==========================================================
                self._emit_progress(20, "generate_scenario", "Scénario pub v7...")

                nb_avant = self.config.get("nb_scenes_avant", 1)

                pub_result = self.scenario_gen.generate_pub_v7(
                    dream_statement=dream_statement,
                    character_name=character_name,
                    character_gender=character_gender,
                    age=age,
                    nb_scenes_avant=nb_avant,
                    nb_dream_scenes=nb_scenes,
                    duree_scene=self.config.get("duree_scene", 6),
                    dream_elements=state.get("dream_elements"),
                    character_analysis=state.get("character_analysis"),
                    style_description=state["style_description"],
                    reject=reject,
                )

                global_scenario, video_scenarios, scene_palettes = \
                    self.scenario_gen.convert_pub_v7_to_pipeline(pub_result)

                state["global_scenario"] = global_scenario
                state["video_scenarios"] = video_scenarios
                state["scene_palettes"] = scene_palettes
                state["switch_data"] = pub_result.get("switch_data", {})

                # Palettes
                pg = pub_result.get("palette_globale", {})
                if isinstance(pg, dict) and pg:
                    state["main_palette"] = [
                        pg.get("principale", "#888888"),
                        pg.get("secondaire", "#666666"),
                        pg.get("accent", "#AAAAAA"),
                        pg.get("neutre_clair", "#CCCCCC"),
                        pg.get("neutre_fonce", "#333333"),
                    ]

                results["steps_executed"].extend([
                    "generate_palette", "generate_scenario", "generate_scenes"
                ])
                self._ensure_dirs()
                self._save_json("scenario_pub_v7_full.json", pub_result)
                self._save_json("scenario_global.json", global_scenario)
                self._save_json("scenarios_video.json", video_scenarios)
                self._save_json("palette.json", {
                    "main_palette": state["main_palette"],
                    "scene_palettes": scene_palettes,
                    "palette_quotidien": pub_result.get("palette_quotidien", []),
                    "palette_globale": pg,
                })

                # Audit log
                audit_data = self.scenario_gen.audit.get_data()
                self._save_json("scenario_pub_v7_audit.json", audit_data)
                self.scenario_gen.audit.save(
                    str(self.run_dir / "json" / "scenario_pub_v7_audit.txt")
                )

            else:
                # ==========================================================
                # LEGACY MODE: PALETTE + SCÉNARIO + SCÈNES SÉPARÉMENT
                # (free_scenes / ancien pub)
                # ==========================================================

                # ÉTAPE 2: PALETTE
                self._emit_progress(20, "generate_palette",
                                    "Génération de la palette de couleurs...")
                if steps.get("generate_palette"):
                    mood_keywords = state.get("dream_elements", {}).get(
                        "mood_keywords", [])

                    palette_result = self.palette_gen.generate_main_palette(
                        dream_statement=dream_statement,
                        style_description=state["style_description"],
                        mood_keywords=mood_keywords,
                        custom_palette=self.config.get("custom_palette")
                    )
                    state["main_palette"] = palette_result.get(
                        "main_palette", [])
                    state["palette_mood"] = palette_result.get("mood", "")
                    results["steps_executed"].append("generate_palette")
                    self._ensure_dirs()
                    self._save_json("palette.json", palette_result)

                # ÉTAPE 3: SCÉNARIO GLOBAL
                self._emit_progress(25, "generate_scenario",
                                    "Création du scénario...")
                if steps.get("generate_scenario"):
                    dream_elements_json = json.dumps(
                        state.get("dream_elements", {}), ensure_ascii=False)

                    if mode == "scenario_pub":
                        state["global_scenario"] = \
                            self.scenario_gen.generate_pub_scenario(
                                dream_statement=dream_statement,
                                daily_context=daily_context or self.config.get(
                                    "daily_context", ""),
                                character_name=character_name,
                                character_gender=character_gender,
                                age=age,
                                nb_dream_scenes=nb_scenes,
                                dream_elements_json=dream_elements_json,
                                reject=reject
                            )
                    elif mode == "free_scenes":
                        result = self.scenario_gen.generate_free_scenes(
                            dream_statement=dream_statement,
                            character_name=character_name,
                            character_gender=character_gender,
                            age=age,
                            nb_scenes=nb_scenes,
                            nb_pov_scenes=nb_pov,
                            dream_elements_json=dream_elements_json,
                            imposed_scenes=self.config.get("imposed_scenes"),
                            reject=reject
                        )
                        state["global_scenario"] = {
                            "title": result.get("title", "Scènes libres"),
                            "same_day": True,
                            "scenes": result.get("scenes", []),
                            "character_b": result.get("character_b", {})
                        }

                    results["steps_executed"].append("generate_scenario")
                    self._ensure_dirs()
                    self._save_json("scenario_global.json",
                                    state["global_scenario"])

                    # Validation de couverture des éléments
                    if state.get("dream_elements"):
                        coverage = self._validate_elements_coverage(
                            state["dream_elements"],
                            state["global_scenario"]
                        )
                        if coverage["coverage_ratio"] < 0.6:
                            results["warnings"].append(
                                f"Couverture éléments du rêve: "
                                f"{coverage['coverage_ratio']:.0%} (< 60%)"
                            )
                            print(f"\n  ⚠️ Couverture éléments: "
                                  f"{coverage['coverage_ratio']:.0%}")
                            print(f"     Manquants: "
                                  f"{coverage.get('missing', [])}")

                # ÉTAPE 4: SCÈNES VIDÉO
                self._emit_progress(35, "generate_scenes",
                                    "Élaboration des scènes vidéo...")
                if steps.get("generate_scenes") and state["global_scenario"]:
                    for scene in state["global_scenario"].get("scenes", []):
                        sid = scene.get("id", 1)
                        scene_type = scene.get("type", "")
                        if scene_type in ("TRANSITION_AWAKENING",
                                          "TRANSITION_ACTION"):
                            continue
                        if state["main_palette"]:
                            sp = self.palette_gen.generate_scene_palette(
                                state["main_palette"], state["palette_mood"],
                                scene.get("time_of_day", "afternoon"),
                                scene.get("indoor", False),
                                scene.get("atmosphere", "")
                            )
                            state["scene_palettes"][sid] = sp.get(
                                "scene_palette", state["main_palette"])

                    features = self.analyzer.format_for_prompt(
                        state["character_analysis"]
                    ) if state.get("character_analysis") else ""

                    if mode == "scenario_pub":
                        state["video_scenarios"] = \
                            self.scenario_gen.generate_pub_video_scenarios(
                                pub_scenario=state["global_scenario"],
                                character_name=character_name,
                                character_gender=character_gender,
                                age=age,
                                character_features=features,
                                scene_palettes=state["scene_palettes"]
                            )
                    else:
                        state["video_scenarios"] = \
                            self.scenario_gen.generate_video_scenarios(
                                global_scenario=state["global_scenario"],
                                character_name=character_name,
                                character_gender=character_gender,
                                age=age,
                                character_features=features,
                                scene_palettes=state["scene_palettes"]
                            )
                    results["steps_executed"].append("generate_scenes")
                    self._save_json("scenarios_video.json",
                                    state["video_scenarios"])
            
            # Extraire le titre du rêve pour nommer les montages
            if state.get("global_scenario"):
                dream_title = state["global_scenario"].get("title", "")
                if dream_title and dream_title != "Reve":
                    self.dream_slug = self._slugify(dream_title)
                    print(f"  🎬 Titre du rêve: {dream_title}")

            # ================================================================
            # ÉTAPES 5-6: KEYFRAMES
            # ================================================================
            self._emit_progress(40, "generate_keyframes", "Génération des images clés...")
            if steps.get("generate_keyframes") and state["video_scenarios"]:
                same_day = state["global_scenario"].get("same_day", True)
                is_pub_mode = mode == "scenario_pub"
                total_kf_scenes = len(state["video_scenarios"])

                for idx, vs in enumerate(state["video_scenarios"]):
                    scene_id = vs["scene_id"]
                    sid = self._sid(scene_id)
                    is_pov = vs.get("is_pov", False)
                    is_first = idx == 0
                    is_last = idx == total_kf_scenes - 1
                    scene_type = vs.get("scene_type", "")

                    # Palette : en mode pub, les scènes de transition utilisent
                    # la dream_palette du scénario ; les scènes standard, leur palette dérivée
                    if is_pub_mode and scene_type in ("TRANSITION_AWAKENING", "TRANSITION_ACTION"):
                        palette = state["global_scenario"].get("dream_palette", state["main_palette"] or [])
                    else:
                        palette = state["scene_palettes"].get(scene_id, state["main_palette"] or [])

                    shooting = vs.get("shooting", {})

                    # same_day : en mode pub, False pour les scènes de rêve (2+)
                    scene_same_day = False if is_pub_mode else same_day

                    # Progress: 40-65% for keyframes
                    kf_pct = 40 + int(25 * idx / max(total_kf_scenes, 1))
                    self._emit_progress(kf_pct, "generate_keyframes", f"Images clés scène {scene_id}/{total_kf_scenes}...")
                    print(f"\n{'='*70}\nSCÈNE {scene_id} {'(POV)' if is_pov else ''} {scene_type}\n{'='*70}")

                    for kf_type in ["start", "end"]:
                        kf_desc = vs.get(f"{kf_type}_keyframe", {})
                        path = self.run_dir / "keyframes" / f"{kf_type}_keyframe_{sid}.png"

                        # Mode pub legacy : le start de 1B = le end de 1A (copie du fichier)
                        if is_pub_mode and scene_type == "TRANSITION_ACTION" and kf_type == "start":
                            end_1a_path = state["keyframe_paths"].get("end_1A")
                            if end_1a_path and Path(end_1a_path).exists():
                                shutil.copy2(end_1a_path, str(path))
                                state["keyframe_paths"][f"start_{sid}"] = str(path)
                                print(f"  [START] Copié depuis end_1A (keyframe partagé)")
                                continue

                        # Mode pub v7 : le start de EXPLORE = copie du end de DISCOVERY (continuité)
                        scene_phase = vs.get("phase", "")
                        if is_pub_mode and scene_phase == "EXPLORE" and kf_type == "start":
                            end_d_path = state["keyframe_paths"].get("end_D")
                            if end_d_path and Path(end_d_path).exists():
                                self._ensure_dirs()
                                shutil.copy2(end_d_path, str(path))
                                state["keyframe_paths"][f"start_{sid}"] = str(path)
                                print(f"  [START] Copié depuis end_D (keyframe partagé D→E)")
                                continue
                            else:
                                print(f"  ⚠️ end_D manquant pour copie vers start_E — fallback génération normale")
                                results["warnings"].append("end_D missing for EXPLORE start, generated normally")

                        # Mode pub v7 : le start de la DISCOVERY = switch Gemini
                        if is_pub_mode and scene_phase == "DISCOVERY" and kf_type == "start":
                            # Trouver le end_kf de la dernière scène PRE_SWITCH
                            last_avant_sid = None
                            for prev_vs in state["video_scenarios"]:
                                if prev_vs.get("phase") == "PRE_SWITCH":
                                    last_avant_sid = self._sid(prev_vs["scene_id"])
                            last_avant_end = state["keyframe_paths"].get(f"end_{last_avant_sid}") if last_avant_sid else None

                            if last_avant_end and Path(last_avant_end).exists():
                                gemini_prompt = state.get("switch_data", {}).get("gemini_prompt", "")
                                switch_max = self.config.get("max_attempts", 5)
                                switch_success = False

                                for attempt in range(switch_max):
                                    print(f"\n  [SWITCH] Tentative {attempt + 1}/{switch_max}")
                                    switch_result = self.image_gen.generate_switch(
                                        source_image=last_avant_end,
                                        prompt=gemini_prompt,
                                        output_path=str(path),
                                    )

                                    if not switch_result.get("success"):
                                        continue

                                    # Validation stricte du switch
                                    if steps.get("validate_keyframes"):
                                        switch_criteria = self.config.get("validation_config_pub_switch", {})
                                        val_result = self.validator.validate(
                                            image_path=str(path),
                                            references={
                                                "user_photo": state["user_photos"][0] if state["user_photos"] else None,
                                                "source_image": last_avant_end,
                                            },
                                            scene_id=scene_id,
                                            kf_type="start",
                                            palette=palette,
                                            description="Switch: same person, different environment",
                                            attempt=attempt + 1,
                                            extra_criteria=switch_criteria,
                                            shot_type="medium",
                                            expected_faces=1,
                                        )

                                        if val_result.get("passed"):
                                            print(f"      ✅ Switch OK (score: {val_result.get('global_score', 0):.2f})")
                                            switch_success = True
                                            break
                                        else:
                                            print(f"      ❌ Switch: {val_result.get('failures', [])[:3]}")
                                    else:
                                        switch_success = True
                                        break

                                if switch_success or Path(path).exists():
                                    state["keyframe_paths"][f"start_{sid}"] = str(path)
                                    print(f"  [START] Switch Gemini (background swap)")
                                else:
                                    print(f"  ❌ SWITCH ÉCHEC après {switch_max} tentatives")
                                    results["errors"].append(f"Switch failed for scene {scene_id}")
                                continue
                            else:
                                print(f"  ⚠️ Pas d'image source pour le switch (end_{last_avant_sid} manquant) — fallback génération normale")
                                results["warnings"].append(
                                    f"Switch impossible: end_{last_avant_sid} missing, DISCOVERY start generated normally"
                                )

                        # Refs pour génération - TOUTES les photos user
                        gen_refs = []
                        if not is_pov and state["user_photos"]:
                            gen_refs.extend(state["user_photos"][:3])
                        if kf_type == "end":
                            start_ref = state["keyframe_paths"].get(f"start_{sid}")
                            if start_ref:
                                gen_refs.append(start_ref)
                        elif not is_first and scene_same_day:
                            # Référence à la première scène pour cohérence same_day
                            first_sid = self._sid(state["video_scenarios"][0]["scene_id"])
                            prev_ref = state["keyframe_paths"].get(f"start_{first_sid}")
                            if prev_ref:
                                gen_refs.append(prev_ref)

                        # Retries différenciés : 7 pour first start et last end, 5 pour le reste
                        is_critical_kf = (is_first and kf_type == "start") or (is_last and kf_type == "end")
                        kf_max_attempts = 7 if is_critical_kf else max_attempts

                        # Mode pub v7: end keyframes D/E → pose edit (garder le MÊME décor que start)
                        use_pose_edit = (
                            is_pub_mode
                            and scene_phase in ("DISCOVERY", "EXPLORE")
                            and kf_type == "end"
                            and state["keyframe_paths"].get(f"start_{sid}")
                        )

                        # Génération avec retry — garde la meilleure tentative
                        success = False
                        best_score = -1.0
                        best_path = None
                        gen_failures = 0
                        for attempt in range(kf_max_attempts):
                            print(f"\n  [{kf_type.upper()}] Tentative {attempt + 1}/{kf_max_attempts}{' (CRITIQUE)' if is_critical_kf else ''}{' (POSE EDIT)' if use_pose_edit else ''}")

                            if use_pose_edit:
                                # Pose edit: garder le décor du start, changer uniquement pose/expression
                                start_source = state["keyframe_paths"][f"start_{sid}"]
                                extra_instr = ""
                                if kf_desc.get("mains"):
                                    extra_instr += f"Hands: {kf_desc['mains']}\n"
                                if kf_desc.get("mouvement"):
                                    extra_instr += f"Movement hint: {kf_desc['mouvement']}\n"
                                gen_result = self.image_gen.generate_pose_edit(
                                    source_image=start_source,
                                    new_pose=kf_desc.get("pose", ""),
                                    new_expression=kf_desc.get("expression", ""),
                                    new_gaze=kf_desc.get("gaze_direction", ""),
                                    output_path=str(path),
                                    extra_instructions=extra_instr,
                                )
                            else:
                                gen_result = self.image_gen.generate_keyframe(
                                    kf_desc, shooting, gen_refs, palette, scene_same_day, is_pov, str(path),
                                    allows_camera_look=(is_last and kf_type == "end" and random.random() < 0.5)
                                )

                            if not gen_result.get("success"):
                                gen_failures += 1
                                print(f"      ⚠️ Génération échouée: {gen_result.get('error', 'unknown')}")
                                if gen_failures >= 2:
                                    time.sleep(3)  # Backoff après échecs répétés
                                continue

                            # Validation
                            if steps.get("validate_keyframes") and not is_pov:
                                first_sid = self._sid(state["video_scenarios"][0]["scene_id"])
                                val_refs = {
                                    "user_photo": state["user_photos"][0] if state["user_photos"] else None,
                                    "previous": state["keyframe_paths"].get(f"start_{first_sid}"),
                                    "start_current": state["keyframe_paths"].get(f"start_{sid}"),
                                }
                                # Construire description complète pour le validateur
                                val_desc_parts = [kf_desc.get("description", "")]
                                if kf_desc.get("outfit"):
                                    val_desc_parts.append(f"Outfit: {kf_desc['outfit']}")
                                if kf_desc.get("outfit_items"):
                                    outfit_detail = ", ".join(
                                        f"{item.get('item','')} {item.get('color','')} {item.get('pattern','')}"
                                        for item in kf_desc["outfit_items"]
                                        if isinstance(item, dict)
                                    )
                                    val_desc_parts.append(f"Outfit items (MUST match exactly): {outfit_detail}")
                                if kf_desc.get("accessories"):
                                    val_desc_parts.append(f"Accessories: {kf_desc['accessories']}")
                                if kf_desc.get("pose"):
                                    val_desc_parts.append(f"Pose: {kf_desc['pose']}")
                                if kf_desc.get("expression"):
                                    val_desc_parts.append(f"Expression: {kf_desc['expression']}")
                                if kf_desc.get("gaze_direction"):
                                    val_desc_parts.append(f"Gaze: {kf_desc['gaze_direction']}")
                                if vs.get("action"):
                                    val_desc_parts.append(f"Action: {vs['action']}")
                                if shooting.get("shot_type"):
                                    val_desc_parts.append(f"Shot: {shooting['shot_type']}, Angle: {shooting.get('camera_angle','')}, Light: {shooting.get('lighting_direction','')}/{shooting.get('lighting_temperature','')}, DoF: {shooting.get('depth_of_field','')}")

                                # Critères additionnels pour les scènes de transition pub
                                extra_criteria = None
                                if is_pub_mode and scene_type in ("TRANSITION_AWAKENING", "TRANSITION_ACTION"):
                                    extra_criteria = self.config.get("validation_config_pub_transition", {})

                                # Nombre de visages attendus (0 si POV)
                                is_pov = vs.get("is_pov", False)
                                expected_faces = 0 if is_pov else 1

                                val_result = self.validator.validate(
                                    image_path=str(path),
                                    references=val_refs,
                                    scene_id=scene_id,
                                    kf_type=kf_type,
                                    palette=palette,
                                    description="\n".join(val_desc_parts),
                                    attempt=attempt + 1,
                                    extra_criteria=extra_criteria,
                                    shot_type=shooting.get("shot_type", "medium"),
                                    expected_faces=expected_faces,
                                )

                                attempt_score = val_result.get("global_score", 0)

                                if val_result.get("passed"):
                                    print(f"      ✅ OK (score: {attempt_score:.2f})")
                                    success = True
                                    best_path = str(path)
                                    break
                                else:
                                    print(f"      ❌ {val_result.get('failures', [])[:3]}")
                                    # Garder la meilleure tentative même si elle échoue
                                    if attempt_score > best_score:
                                        best_score = attempt_score
                                        # Sauver sous un nom temporaire pour ne pas écraser
                                        best_tmp = str(path) + f".best"
                                        shutil.copy2(str(path), best_tmp)
                                        best_path = best_tmp
                            else:
                                success = True
                                best_path = str(path)
                                break

                        # Gestion de l'échec après toutes les tentatives
                        if not success:
                            if is_critical_kf:
                                # Keyframe critique (first start / last end) : JAMAIS de fallback
                                if best_path and best_path != str(path):
                                    Path(best_path).unlink(missing_ok=True)
                                print(f"      ❌ ÉCHEC CRITIQUE: {kf_type} scène {scene_id} — "
                                      f"keyframe {'première' if is_first else 'dernière'} non validée après {kf_max_attempts} tentatives")
                                results["errors"].append(
                                    f"Critical keyframe {kf_type} scene {scene_id} failed validation after {kf_max_attempts} attempts"
                                )
                                # Ne pas continuer — on ne peut pas avoir une première/dernière image non ressemblante
                                continue
                            elif best_path and best_path != str(path):
                                # Keyframe non critique : utiliser la meilleure tentative (validée mais échouée)
                                shutil.copy2(best_path, str(path))
                                Path(best_path).unlink(missing_ok=True)
                                print(f"      ⚠️ Aucune tentative validée — utilisation de la meilleure (score: {best_score:.2f})")
                            elif gen_failures == kf_max_attempts:
                                # Toutes les générations ont échoué (API errors)
                                print(f"      ❌ TOUTES les générations ont échoué pour {kf_type} scène {scene_id}")
                                results["warnings"].append(
                                    f"All {kf_max_attempts} generation attempts failed for {kf_type} scene {scene_id}"
                                )
                            elif Path(path).exists():
                                # Le fichier existe d'une tentative (généré mais best_path non créé)
                                print(f"      ⚠️ Utilisation de la dernière image générée (non validée)")

                        # Nettoyer le fichier .best s'il reste
                        if best_path and best_path != str(path):
                            Path(best_path).unlink(missing_ok=True)

                        # Enregistrer le keyframe si disponible
                        file_exists = Path(path).exists()
                        if success or (not is_critical_kf and file_exists):
                            state["keyframe_paths"][f"{kf_type}_{sid}"] = str(path)
                            if is_first and kf_type == "start":
                                first_sid = self._sid(scene_id)
                                state["keyframe_paths"][f"start_{first_sid}"] = str(path)

                results["steps_executed"].append("generate_keyframes")
                if steps.get("validate_keyframes"):
                    results["steps_executed"].append("validate_keyframes")
            
            # ================================================================
            # ÉTAPE 7: VIDÉOS AVEC RETRY
            # ================================================================
            self._emit_progress(65, "generate_videos", "Génération des vidéos...")
            if steps.get("generate_videos"):
                state["video_paths"] = []
                state["failed_videos"] = []

                total_scenes = len(state.get("video_scenarios") or [])

                for idx, vs in enumerate(state.get("video_scenarios") or []):
                    scene_id = vs.get("scene_id", 1)
                    sid = self._sid(scene_id)
                    start_p = state["keyframe_paths"].get(f"start_{sid}")
                    end_p = state["keyframe_paths"].get(f"end_{sid}")

                    if not start_p or not end_p:
                        print(f"\n⚠️ Scène {scene_id}: Keyframes manquants, skip")
                        state["failed_videos"].append(scene_id)
                        results["warnings"].append(f"Scene {scene_id}: missing keyframes")
                        continue

                    video_path = self.run_dir / "videos" / f"scene_{sid}.mp4"
                    shooting = vs.get("shooting", {})

                    # Progress: 65-92% for videos
                    vid_pct = 65 + int(27 * idx / max(total_scenes, 1))
                    self._emit_progress(vid_pct, "generate_videos", f"Vidéo scène {scene_id}/{total_scenes}...")

                    # RETRY LOOP
                    video_success = False
                    for attempt in range(self.MAX_VIDEO_ATTEMPTS):
                        print(f"\n--- VIDÉO SCÈNE {scene_id} - Tentative {attempt + 1}/{self.MAX_VIDEO_ATTEMPTS} ---")
                        
                        result = self.video_gen.generate(
                            start_p, end_p, vs.get("action", ""),
                            shooting.get("camera_movement", "static"),
                            vs.get("is_pov", False), 6, str(video_path),
                            transition_path=vs.get("transition_path", ""))
                        
                        if result.get("success"):
                            print(f"   ✅ Vidéo scène {scene_id} générée")
                            state["video_paths"].append(str(video_path))
                            video_success = True
                            break
                        else:
                            error_msg = result.get("error", "Unknown error")
                            print(f"   ❌ Échec: {error_msg}")
                            if attempt < self.MAX_VIDEO_ATTEMPTS - 1:
                                print(f"   🔄 Nouvelle tentative...")
                    
                    if not video_success:
                        print(f"\n❌ ÉCHEC DÉFINITIF: Scène {scene_id} après {self.MAX_VIDEO_ATTEMPTS} tentatives")
                        state["failed_videos"].append(scene_id)
                        results["errors"].append(f"Scene {scene_id}: video generation failed")
                
                results["steps_executed"].append("generate_videos")
                
                # Validation de complétude
                videos_generated = len(state["video_paths"])
                videos_failed = len(state["failed_videos"])
                
                print(f"\n{'='*70}")
                print(f"BILAN VIDÉOS: {videos_generated}/{total_scenes} générées")
                if videos_failed > 0:
                    print(f"⚠️ Scènes en échec: {state['failed_videos']}")
                print("=" * 70)
                
                if videos_failed > 0:
                    results["errors"].append(f"{videos_failed} video(s) failed")
                    results["success"] = False
                    steps["generate_montage"] = False
            
            # ================================================================
            # ÉTAPE 8: MONTAGE
            # ================================================================
            self._emit_progress(93, "generate_montage", "Montage final de la vidéo...")
            if steps.get("generate_montage"):
                if not state["video_paths"]:
                    print("\n❌ Aucune vidéo à monter!")
                    results["errors"].append("No videos to concatenate")
                    results["success"] = False
                elif state.get("failed_videos"):
                    print(f"\n❌ Montage annulé: {len(state['failed_videos'])} vidéo(s) manquante(s)")
                    results["success"] = False
                elif self.dry_run:
                    if mode == "scenario_pub":
                        avant_path = self.run_dir / f"before_{self.dream_slug}.mp4"
                        apres_path = self.run_dir / f"after_{self.dream_slug}.mp4"
                        print(f"\n[DRY RUN] Montage pub simulé: {avant_path} + {apres_path}")
                        results["final_video_avant"] = str(avant_path)
                        results["final_video_apres"] = str(apres_path)
                    else:
                        final_path = self.run_dir / "final.mp4"
                        print(f"\n[DRY RUN] Montage simulé: {final_path}")
                        results["final_video"] = str(final_path)
                    results["success"] = True
                    results["steps_executed"].append("generate_montage")
                elif mode == "scenario_pub":
                    # Pub mode: deux montages séparés (avant.mp4 + apres.mp4)
                    video_scenarios = state.get("video_scenarios") or []

                    # Identifier les scènes PRE_SWITCH vs le reste
                    avant_sids = set()
                    for vs in video_scenarios:
                        if vs.get("phase") == "PRE_SWITCH":
                            avant_sids.add(self._sid(vs["scene_id"]))

                    avant_videos = []
                    apres_videos = []
                    for vp in state["video_paths"]:
                        vp_name = Path(vp).stem  # scene_0A, scene_D, scene_01...
                        vp_sid = vp_name.replace("scene_", "")
                        if vp_sid in avant_sids:
                            avant_videos.append(vp)
                        else:
                            apres_videos.append(vp)

                    montage_success = True

                    if avant_videos:
                        avant_path = self.run_dir / f"before_{self.dream_slug}.mp4"
                        if len(avant_videos) == 1:
                            # Single video: just copy
                            shutil.copy2(avant_videos[0], str(avant_path))
                            results["final_video_avant"] = str(avant_path)
                            print(f"\n✅ Before: {avant_path} (copie directe)")
                        else:
                            result_avant = self.montage.concat(avant_videos, str(avant_path))
                            if result_avant.get("success"):
                                results["final_video_avant"] = str(avant_path)
                                print(f"\n✅ Montage before: {avant_path} ({len(avant_videos)} vidéo(s))")
                            else:
                                results["errors"].append("Montage before failed")
                                montage_success = False

                    if apres_videos:
                        apres_path = self.run_dir / f"after_{self.dream_slug}.mp4"
                        if len(apres_videos) == 1:
                            shutil.copy2(apres_videos[0], str(apres_path))
                            results["final_video_apres"] = str(apres_path)
                            print(f"\n✅ After: {apres_path} (copie directe)")
                        else:
                            result_apres = self.montage.concat(apres_videos, str(apres_path))
                            if result_apres.get("success"):
                                results["final_video_apres"] = str(apres_path)
                                print(f"\n✅ Montage after: {apres_path} ({len(apres_videos)} vidéo(s))")
                            else:
                                results["errors"].append("Montage apres failed")
                                montage_success = False

                    results["success"] = montage_success
                    results["steps_executed"].append("generate_montage")
                else:
                    final_path = self.run_dir / "final.mp4"
                    result = self.montage.concat(state["video_paths"], str(final_path))
                    if result.get("success"):
                        results["final_video"] = str(final_path)
                        results["success"] = True
                        print(f"\n✅ Montage final: {final_path}")
                    else:
                        results["errors"].append("Montage failed")
                        results["success"] = False
                    results["steps_executed"].append("generate_montage")
            
            # Succès si pas de montage demandé et pas d'erreurs
            if (not steps.get("generate_montage") or self.dry_run) and not results["errors"]:
                results["success"] = True
            
            # Metadata pour le backend
            results["scenario_name"] = state.get("global_scenario", {}).get("title", "")
            results["scenes_count"] = len(state.get("video_scenarios") or state.get("global_scenario", {}).get("scenes", []))
            results["total_duration"] = len(state.get("video_paths", [])) * 6

            # Coûts réels
            results["costs_real"] = {
                "dream_analyzer": self.dream_analyzer.get_real_cost(),
                "character_analyzer": self.analyzer.get_real_cost(),
                "palette_generator": self.palette_gen.get_real_cost(),
                "scenario_generator": self.scenario_gen.get_real_cost(),
                "image_generator": self.image_gen.get_real_cost(),
                "image_validator": self.validator.get_real_cost(),
                "video_generator": self.video_gen.get_real_cost(),
                "video_montage": self.montage.get_real_cost(),
            }

            # V7 audit data (dialogue entre agents IA)
            if mode in ("scenario", "scenario_pub"):
                results["scenario_v7_audit"] = self.scenario_gen.audit.get_data()
                results["scenario_v7_llm_stats"] = {
                    "calls": self.scenario_gen.costs_real["calls"],
                    "tokens_input": self.scenario_gen.costs_real["tokens_input"],
                    "tokens_output": self.scenario_gen.costs_real["tokens_output"],
                }
                results["scenario_v7_cost_breakdown"] = self.scenario_gen.get_cost_breakdown()
            
        except Exception as e:
            print(f"\n❌ ERREUR: {e}")
            results["error"] = str(e)
            results["errors"].append(str(e))
            import traceback
            traceback.print_exc()
        
        # Sauvegarder seulement si des répertoires ont été créés
        if self._dirs_created:
            self._save_json("results.json", results)
            # Sauvegarder les données de validation
            if self.validator:
                self._save_json("validation_report.json", self.validator.get_validation_data())

        self._print_summary(results)
        
        return results
    
    @staticmethod
    def _sid(scene_id) -> str:
        """Formate un scene_id pour les noms de fichiers et clés dict.
        Gère les IDs string ('1A', '1B') et int (2, 3, ...)."""
        if isinstance(scene_id, str):
            return scene_id
        return f"{scene_id:02d}"

    def _ensure_dirs(self):
        """Crée les répertoires seulement quand nécessaire."""
        if not self._dirs_created:
            for d in ["keyframes", "videos", "json"]:
                (self.run_dir / d).mkdir(parents=True, exist_ok=True)
            self._dirs_created = True
    
    def _deduce_style(self, analysis: Dict) -> str:
        """Déduit le style vestimentaire de l'analyse."""
        if not analysis:
            return "classique"
        
        accessories = analysis.get("accessories", [])
        hair = analysis.get("hair", {})
        
        # Logique simple pour déduire le style
        if len(accessories) > 2:
            return "créatif/excentrique"
        if hair.get("color_name") in ["red", "white", "gray"]:
            return "affirmé"
        return "classique/sobre"
    
    def _validate_elements_coverage(self, dream_elements: Dict, scenario: Dict) -> Dict:
        """Valide que les éléments du rêve sont couverts par le scénario."""
        explicit = dream_elements.get("user_explicit_elements", [])
        scenes_text = " ".join([
            f"{s.get('concept', '')} {s.get('action', '')} {s.get('location', '')}"
            for s in scenario.get("scenes", [])
        ]).lower()
        
        covered = []
        missing = []
        
        for elem in explicit:
            # Recherche simple - peut être améliorée
            if any(word in scenes_text for word in elem.lower().split()):
                covered.append(elem)
            else:
                missing.append(elem)
        
        ratio = len(covered) / len(explicit) if explicit else 1.0
        
        return {
            "covered": covered,
            "missing": missing,
            "coverage_ratio": ratio
        }
    
    def _load_keyframes(self, kf_dir):
        paths = {}
        for f in Path(kf_dir).glob("start_keyframe_*.png"):
            num = f.stem.replace("start_keyframe_", "")
            paths[f"start_{num}"] = str(f)
            if num == "01":
                paths["start_01"] = str(f)
        for f in Path(kf_dir).glob("end_keyframe_*.png"):
            num = f.stem.replace("end_keyframe_", "")
            paths[f"end_{num}"] = str(f)
        return paths
    
    def _save_json(self, filename, data):
        self._ensure_dirs()
        with open(self.run_dir / "json" / filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    def _slugify(self, text):
        import re
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text.lower())
        text = re.sub(r'\s+', '_', text.strip())
        return text[:30] if text else "untitled"
    
    def _print_summary(self, results):
        print(f"\n{'='*70}\nRÉSUMÉ\n{'='*70}")
        print(f"📋 Étapes: {', '.join(results.get('steps_executed', []))}")
        print(f"📁 Output: {self.run_dir}")
        
        if results.get("final_video"):
            print(f"🎬 Vidéo: {results['final_video']}")
        
        if results.get("warnings"):
            print(f"\n⚠️ WARNINGS:")
            for w in results["warnings"]:
                print(f"   - {w}")
        
        if results.get("errors"):
            print(f"\n❌ ERREURS:")
            for e in results["errors"]:
                print(f"   - {e}")
        
        if results.get("costs_real"):
            total = sum(results["costs_real"].values())
            print(f"\n💰 Coût réel total: {total:.4f}€")
        
        if results.get("success"):
            print("\n✅ Succès!")
        else:
            print("\n❌ ÉCHEC - Voir les erreurs ci-dessus")
        
        report = self.validator.get_failure_report()
        if "Aucune" not in report:
            print(report)
