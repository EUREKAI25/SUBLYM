# config/models.py (ou direct dans ton backend)
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple
import importlib.util
from pathlib import Path


# --- CONFIG : 1 modèle "active" par catégorie + script + callable + mapping args ---
MODELS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "vision": {
        # Vision -> texte (caption, analyse, OCR sémantique)
        "llava-v1.6-mistral-7b": {
            "status": "active",
            "script": "/mnt/data/AI_get_text_from_image.py",
            "callable": "get_text_from_image",
            "args": {  # kwargs du callable
                "prompt": "$prompt",
                "image": "image",  # datas["image"] (path ou url)
            },
        },
    },

    "imgimg": {
        # Texte -> image (Flux)
        "flux-2-dev": {
            "status": "active",
            "script": "/mnt/data/AI_get_image_from_text.py",
            "callable": "get_image_from_text",
            "args": {
                "prompt": "$prompt",
                # optionnels si tu les passes dans datas
                "aspect_ratio": "aspect_ratio",
                "output_format": "output_format",
                "output_quality": "output_quality",
            },
        },
        # Image -> image (Flux Kontext) (script contient get_image_from_image / get_image_from_text aussi)
        "flux-kontext": {
            "script": "/mnt/data/AI_get_image_from_image.py",
            "callable": "get_image_from_image",
            "args": {
                "prompt": "$prompt",
                "images": "images",                 # datas["images"] = list[str]
                "aspect_ratio": "aspect_ratio",
                "output_format": "output_format",
                "output_quality": "output_quality",
            },
        },
        # Gemini 3 Pro (si tu l’utilises pour imgimg)
        "gemini-3-pro": {
            "script": "/mnt/data/AI_get_image_gemini.py",
            "callable": "generate_image_gemini3_pro",
            "args": {
                "prompt": "$prompt",
                "image_path": "image_path",         # datas["image_path"] si img->img
                "output_path": "output_path",
            },
        },
    },

    "imgvideo": {
        "minimax-hailuo-i2v": {
            "status": "active",
            "script": "/mnt/data/AI_get_video_from_image.py",
            "callable": "generate_scene_video",
            "args": {
                "prompt": "$prompt",
                "start_image_url": "start_image_url",  # datas["start_image_url"]
                "end_image_url": "end_image_url",      # datas["end_image_url"]
                "duration": "duration",                # optionnel
                "provider": "provider",                # optionnel ("minimax"|"fal")
            },
        },
    },

    "txtaudio": {
        "music-gpt": {
            "status": "active",
            "script": None,        # pas de script fourni pour l’instant
            "callable": None,
            "args": {"prompt": "$prompt"},
        },
    },
}


# --- helpers ---
def _import_callable(script_path: str, func_name: str):
    p = Path(script_path)
    if not p.exists():
        raise FileNotFoundError(f"script introuvable: {script_path}")

    module_name = f"_dyn_{p.stem}"
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"import impossible: {script_path}")

    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]

    fn = getattr(mod, func_name, None)
    if fn is None:
        raise AttributeError(f"callable '{func_name}' introuvable dans {script_path}")
    return fn


def model_get_active(modeltype: str) -> Tuple[str, Dict[str, Any]]:
    cat = MODELS.get(modeltype)
    if not cat:
        raise KeyError(f"modeltype inconnu: {modeltype}")

    for model_name, cfg in cat.items():
        if cfg.get("status") == "active":
            return model_name, cfg

    raise ValueError(f"aucun modèle 'active' pour la catégorie: {modeltype}")


def _build_kwargs(argmap: Dict[str, Any], prompt: str, datas: Dict[str, Any]) -> Dict[str, Any]:
    kwargs: Dict[str, Any] = {}
    for param_name, source in (argmap or {}).items():
        if source == "$prompt":
            kwargs[param_name] = prompt
        else:
            # On n’injecte que si la clé existe (ultra minimal / pas de bruit)
            if isinstance(source, str) and source in datas:
                kwargs[param_name] = datas[source]
    return kwargs


# --- API demandée ---
def model_execute(modeltype: str, prompt: str, datas: Dict[str, Any]) -> Dict[str, Any]:
    model_name, cfg = model_get_active(modeltype)

    script = cfg.get("script")
    func_name = cfg.get("callable")
    argmap = cfg.get("args", {})

    # Placeholder (audio non branché)
    if not script or not func_name:
        return {"status": "noop", "model": model_name, "reason": "no_script_bound", "input": datas}

    fn = _import_callable(script, func_name)
    kwargs = _build_kwargs(argmap, prompt, datas)

    out = fn(**kwargs)

    # Normalisation minimale: toujours un dict
    if isinstance(out, dict):
        out.setdefault("meta", {})
        out["meta"].setdefault("active_model", model_name)
        out["meta"].setdefault("modeltype", modeltype)
        return out

    return {"output": out, "meta": {"active_model": model_name, "modeltype": modeltype}}
