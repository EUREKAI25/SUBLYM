import os, json, time, subprocess
from typing import Dict, Any, List
from ..core.settings import settings

def read_constraints_and_howto(style: str) -> Dict[str, str]:
    constraints = ""
    try:
        with open(settings.constraints_path, "r", encoding="utf-8") as f:
            constraints = f.read()
    except FileNotFoundError:
        constraints = ""
    howto_path = os.path.join(settings.howto_dir, f"how_to_{style}.txt")
    howto = ""
    if os.path.exists(howto_path):
        howto = open(howto_path, "r", encoding="utf-8").read()
    return {"constraints": constraints, "howto": howto}

def make_plan(dream: str, mode: str, nb_scenes: int, scene_duration: int, style: str, constraints: str, howto: str) -> Dict[str, Any]:
    scenes = []
    if nb_scenes == 3:
        roles = ["pre", "bridge", "post"]
    else:
        roles = [f"step_{i+1}" for i in range(nb_scenes)]
    for i in range(nb_scenes):
        scenes.append({
            "scene_id": i + 1,
            "role": roles[i],
            "duration_s": scene_duration,
            "scene_prompt_video": f"[STYLE={style}] Scene {i+1}/{nb_scenes} ({roles[i]}). Dream: {dream}",
            "mode": mode,
        })
    return {
        "dream": dream,
        "mode": mode,
        "nb_scenes": nb_scenes,
        "scene_duration_s": scene_duration,
        "style": style,
        "constraints_injected": bool(constraints.strip()),
        "howto_injected": bool(howto.strip()),
        "scenes": scenes,
    }

def _ffmpeg_make_dummy_video(out_path: str, duration: int, label: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=1280x720:rate=25",
        "-t",
        str(duration),
        "-vf",
        f"drawtext=text='{label}':x=40:y=40:fontsize=48:fontcolor=white:box=1:boxcolor=0x000000AA",
        "-pix_fmt",
        "yuv420p",
        out_path,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def _ffmpeg_concat(video_paths: List[str], out_path: str):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    lst_path = out_path + ".concat.txt"
    with open(lst_path, "w", encoding="utf-8") as f:
        for vp in video_paths:
            f.write(f"file '{vp}'\n")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst_path, "-c", "copy", out_path]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def run_pipeline_dry(user_dir: str, dream_id: str, dream: str, style: str, mode: str, nb_scenes: int, scene_duration: int) -> Dict[str, Any]:
    t0 = time.time()
    injected = read_constraints_and_howto(style)
    plan = make_plan(dream, mode, nb_scenes, scene_duration, style, injected["constraints"], injected["howto"])
    plan_path = os.path.join(user_dir, "plan.json")
    with open(plan_path, "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)

    vids = []
    for s in plan["scenes"]:
        outp = os.path.join(user_dir, "videos", f"scene_{s['scene_id']:02d}.mp4")
        _ffmpeg_make_dummy_video(outp, s["duration_s"], f"scene {s['scene_id']:02d}")
        vids.append(outp)

    final_path = os.path.join(user_dir, "final.mp4")
    _ffmpeg_concat(vids, final_path)

    dt = time.time() - t0
    manifest = {
        "dream_id": dream_id,
        "mode": mode,
        "nb_scenes": nb_scenes,
        "scene_duration_s": scene_duration,
        "total_duration_s": nb_scenes * scene_duration,
        "execution_seconds": round(dt, 3),
        "costs": {
            "text": {"provider": "dryrun", "cost_eur": 0.0},
            "video": {"provider": "ffmpeg_lavfi", "cost_eur": 0.0},
            "total_eur": 0.0,
        },
        "outputs": {"plan": plan_path, "final_video": final_path, "scenes": vids},
    }
    manifest_path = os.path.join(user_dir, "run_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return {"plan_path": plan_path, "final_path": final_path, "manifest_path": manifest_path, "execution_seconds": dt}
