"""
Sublym v4 - Face Validator
Triple validation faciale : DeepFace + ArcFace + Gemini
"""

import json
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

# Imports conditionnels pour les dépendances optionnelles
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("⚠️ DeepFace non installé. pip install deepface")

try:
    import insightface
    from insightface.app import FaceAnalysis
    import numpy as np
    ARCFACE_AVAILABLE = True
except ImportError:
    ARCFACE_AVAILABLE = False
    print("⚠️ InsightFace non installé. pip install insightface onnxruntime")


class FaceValidator:
    """
    Validation faciale DeepFace + ArcFace.

    Règle de validation:
    - L'écart cumulé des 2 scores (DeepFace + ArcFace) par rapport au seuil (0.8)
      doit être < tolerance
    """
    
    DEFAULT_THRESHOLD = 0.8
    
    def __init__(self, config: Dict, run_dir: str, verbose: bool = False):
        self.config = config
        self.run_dir = Path(run_dir)
        self.verbose = verbose
        
        # Paramètres de validation
        face_config = config.get("face_validation", {})
        self.gemini_min = face_config.get("gemini_min", 0.7)
        self.tolerance = face_config.get("tolerance", 0.4)
        self.threshold = face_config.get("threshold", self.DEFAULT_THRESHOLD)
        
        # Répertoire pour les images rejetées
        self.rejected_dir = self.run_dir / "rejected"
        
        # Initialiser ArcFace si disponible
        self.arcface_app = None
        if ARCFACE_AVAILABLE:
            try:
                self.arcface_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
                self.arcface_app.prepare(ctx_id=0, det_size=(640, 640))
            except Exception as e:
                print(f"⚠️ Erreur init ArcFace: {e}")
                self.arcface_app = None
        
        # Stats
        self.stats = {
            "total_validations": 0,
            "passed": 0,
            "rejected": 0,
            "rejected_details": []
        }
    
    def validate(
        self,
        generated_image_path: str,
        reference_image_path: str,
        gemini_score: Optional[float] = None,
        scene_id: int = 0,
        kf_type: str = "",
        attempt: int = 1
    ) -> Dict[str, Any]:
        """
        Valide une image générée contre la référence.
        Utilise DeepFace + ArcFace uniquement.

        Returns:
            {
                "passed": bool,
                "scores": {"deepface": float, "arcface": float},
                "cumulative_gap": float,
                "reason": str or None
            }
        """
        self.stats["total_validations"] += 1

        scores = {
            "deepface": 0.0,
            "arcface": 0.0,
        }

        # Score DeepFace
        if DEEPFACE_AVAILABLE:
            scores["deepface"] = self._get_deepface_score(generated_image_path, reference_image_path)
        else:
            scores["deepface"] = 0.5  # Score neutre si non disponible

        # Score ArcFace
        if ARCFACE_AVAILABLE and self.arcface_app:
            scores["arcface"] = self._get_arcface_score(generated_image_path, reference_image_path)
        else:
            scores["arcface"] = 0.5  # Score neutre si non disponible

        # Calcul de l'écart cumulé (DeepFace + ArcFace seulement)
        cumulative_gap = 0.0
        for score in scores.values():
            if score < self.threshold:
                cumulative_gap += (self.threshold - score)

        # Règle de validation : écart cumulé DF+AF < tolerance
        gap_ok = cumulative_gap < self.tolerance
        passed = gap_ok

        # Raison du rejet
        reason = None
        if not passed:
            reason = f"Écart cumulé {cumulative_gap:.2f} >= {self.tolerance}"

        result = {
            "passed": passed,
            "scores": scores,
            "cumulative_gap": cumulative_gap,
            "reason": reason
        }

        # ===== DEBUG: Toujours afficher les scores face =====
        print(f"\n      --- FACE VALIDATION (DeepFace + ArcFace) ---")
        print(f"      DeepFace:  {scores['deepface']:.4f}  (threshold: {self.threshold})")
        print(f"      ArcFace:   {scores['arcface']:.4f}  (threshold: {self.threshold})")
        print(f"      Cumul gap: {cumulative_gap:.4f}  (tolerance: {self.tolerance})")
        print(f"      PASSED: {passed}")
        if reason:
            print(f"      Reason:    {reason}")
        print(f"      ---")
        
        # Sauvegarder si rejeté
        if not passed:
            self._save_rejected(generated_image_path, scores, cumulative_gap, reason, scene_id, kf_type, attempt)
            self.stats["rejected"] += 1
        else:
            self.stats["passed"] += 1
        
        return result
    
    def _get_deepface_score(self, img1: str, img2: str) -> float:
        """Obtient le score DeepFace (converti en 0-1)."""
        try:
            result = DeepFace.verify(
                img1_path=img1,
                img2_path=img2,
                model_name="VGG-Face",
                enforce_detection=False,
                detector_backend="retinaface"
            )
            
            # DeepFace retourne une distance, on convertit en score
            distance = result.get("distance", 1.0)
            threshold = result.get("threshold", 0.4)
            verified = result.get("verified", False)

            # Conversion en score 0-1 (1 = identique)
            # Map so that distance=0 → 1.0, distance=threshold → 0.8
            if distance <= threshold:
                score = 1.0 - 0.2 * (distance / threshold) if threshold > 0 else 1.0
            else:
                score = max(0, 0.8 * (1 - (distance - threshold) / threshold)) if threshold > 0 else 0.0

            print(f"      [DeepFace] distance={distance:.4f} threshold={threshold:.4f} verified={verified} → score={score:.4f}")
            return score
            
        except Exception as e:
            if self.verbose:
                print(f"      ⚠️ DeepFace error: {e}")
            return 0.5  # Score neutre en cas d'erreur
    
    def _get_arcface_score(self, img1: str, img2: str) -> float:
        """Obtient le score ArcFace (similarité cosinus convertie en 0-1)."""
        try:
            import cv2
            
            # Charger les images
            img1_cv = cv2.imread(img1)
            img2_cv = cv2.imread(img2)
            
            if img1_cv is None or img2_cv is None:
                return 0.5
            
            # Détecter les visages et extraire les embeddings
            faces1 = self.arcface_app.get(img1_cv)
            faces2 = self.arcface_app.get(img2_cv)
            
            if not faces1 or not faces2:
                if self.verbose:
                    print(f"      ⚠️ ArcFace: visage non détecté")
                return 0.5
            
            # Prendre le premier visage de chaque image
            emb1 = faces1[0].embedding
            emb2 = faces2[0].embedding
            
            # Similarité cosinus
            cosine_sim = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))

            # Conversion en score 0-1
            # ArcFace typical threshold for "same person" is ~0.3-0.4 cosine similarity
            # Map: cosine_sim=0.0 → 0.5, cosine_sim=0.4 → 0.8, cosine_sim=1.0 → 1.0
            ARCFACE_THRESHOLD = 0.35
            if cosine_sim >= ARCFACE_THRESHOLD:
                score = 0.8 + 0.2 * ((cosine_sim - ARCFACE_THRESHOLD) / (1 - ARCFACE_THRESHOLD))
            else:
                score = max(0, 0.8 * (cosine_sim / ARCFACE_THRESHOLD))

            print(f"      [ArcFace] cosine_sim={cosine_sim:.4f} faces_detected=({len(faces1)},{len(faces2)}) → score={score:.4f}")
            return float(score)
            
        except Exception as e:
            if self.verbose:
                print(f"      ⚠️ ArcFace error: {e}")
            return 0.5
    
    def _save_rejected(
        self,
        image_path: str,
        scores: Dict[str, float],
        gap: float,
        reason: str,
        scene_id: int,
        kf_type: str,
        attempt: int
    ):
        """Sauvegarde une image rejetée avec ses métadonnées."""
        self.rejected_dir.mkdir(parents=True, exist_ok=True)
        
        # Nom du fichier
        timestamp = datetime.now().strftime("%H%M%S")
        filename = f"scene{scene_id:02d}_{kf_type}_att{attempt}_{timestamp}.png"
        dest_path = self.rejected_dir / filename
        
        # Copier l'image
        try:
            shutil.copy2(image_path, dest_path)
        except Exception as e:
            print(f"      ⚠️ Erreur copie image rejetée: {e}")
            return
        
        # Sauvegarder les métadonnées
        meta = {
            "original_path": str(image_path),
            "scene_id": scene_id,
            "keyframe_type": kf_type,
            "attempt": attempt,
            "scores": scores,
            "cumulative_gap": gap,
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        }
        
        meta_path = self.rejected_dir / f"{filename}.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        
        # Ajouter aux stats
        self.stats["rejected_details"].append(meta)
        
        if self.verbose:
            print(f"      📁 Rejetée sauvegardée: {filename}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Retourne les statistiques de validation."""
        return self.stats
    
    def get_summary(self) -> str:
        """Retourne un résumé textuel."""
        total = self.stats["total_validations"]
        if total == 0:
            return "Aucune validation faciale effectuée"
        
        passed = self.stats["passed"]
        rejected = self.stats["rejected"]
        rate = (passed / total) * 100
        
        summary = f"Validation faciale: {passed}/{total} ({rate:.0f}%)"
        if rejected > 0:
            summary += f"\n   Images rejetées: {self.rejected_dir}"
        
        return summary
