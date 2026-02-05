"""
Sublym v4 - Audit Log
Trace détaillée de la génération de scénario (Scenario Agent v7)
"""

from datetime import datetime
from typing import Any, List


class AuditLog:
    """Journal d'audit complet pour la génération de scénario."""

    def __init__(self):
        self.entries: List[str] = []
        self.start_time = datetime.now()

    def log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        self.entries.append(entry)
        print(entry)

    def section(self, title: str):
        separator = "=" * 70
        self.entries.append("")
        self.entries.append(separator)
        self.entries.append(f"  {title}")
        self.entries.append(separator)
        print(f"\n{separator}")
        print(f"  {title}")
        print(separator)

    def subsection(self, title: str):
        separator = "-" * 70
        self.entries.append("")
        self.entries.append(separator)
        self.entries.append(f"  {title}")
        self.entries.append(separator)
        print(f"\n{separator}")
        print(f"  {title}")
        print(separator)

    def detail(self, key: str, value: Any, indent: int = 0):
        prefix = "   " * indent
        if isinstance(value, dict):
            self.entries.append(f"{prefix}{key}:")
            print(f"{prefix}{key}:")
            for k, v in value.items():
                self.detail(k, v, indent + 1)
        elif isinstance(value, list):
            self.entries.append(f"{prefix}{key}: [{len(value)} items]")
            print(f"{prefix}{key}: [{len(value)} items]")
            for i, item in enumerate(value[:5]):
                item_str = str(item)[:100] + "..." if len(str(item)) > 100 else str(item)
                self.entries.append(f"{prefix}   [{i+1}] {item_str}")
                print(f"{prefix}   [{i+1}] {item_str}")
            if len(value) > 5:
                self.entries.append(f"{prefix}   ... et {len(value)-5} de plus")
                print(f"{prefix}   ... et {len(value)-5} de plus")
        else:
            value_str = str(value)[:200] + "..." if len(str(value)) > 200 else str(value)
            self.entries.append(f"{prefix}{key}: {value_str}")
            print(f"{prefix}{key}: {value_str}")

    def validation(self, v1: dict, v2: dict, v3: dict):
        """Legacy triple validation display (rétrocompatibilité)."""
        v1_icon = "PASS" if v1.get("passed") else "FAIL"
        v2_icon = "PASS" if v2.get("passed") else "FAIL"
        v3_icon = "PASS" if v3.get("final_pass") else "FAIL"

        lines = [
            f"   V1: {v1.get('score', 0):.0%} [{v1_icon}] {v1.get('feedback', '')[:60]}",
            f"   V2: {v2.get('score', 0):.0%} [{v2_icon}] {v2.get('feedback', '')[:60]}",
            f"   V3: [{v3_icon}] {v3.get('reasoning', '')[:60]}"
        ]
        for line in lines:
            self.entries.append(line)
            print(line)

        for s in v3.get('optimization_suggestions', [])[:2]:
            self.entries.append(f"      > {s[:70]}")
            print(f"      > {s[:70]}")

    def validation_single(self, val: dict):
        """Validation unique (critère + cohérence + règles en 1 appel)."""
        icon = "PASS" if val.get("passed") else "FAIL"
        crit = "OK" if val.get("criterion_ok") else "FAIL"
        coher = "OK" if val.get("coherence_ok") else "FAIL"
        rules = "OK" if val.get("rules_ok") else "FAIL"

        lines = [
            f"   VAL: {val.get('score', 0):.0%} [{icon}] "
            f"critere={crit} coherence={coher} regles={rules}",
            f"   > {val.get('feedback', '')[:80]}",
        ]
        for line in lines:
            self.entries.append(line)
            print(line)

        for s in val.get("suggestions", [])[:2]:
            self.entries.append(f"      > {s[:70]}")
            print(f"      > {s[:70]}")

    def save(self, filepath: str):
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"SCENARIO AGENT v7 - AUDIT LOG\n")
            f.write(f"Date: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Duree: {(datetime.now() - self.start_time).seconds}s\n")
            f.write("=" * 80 + "\n\n")
            f.write("\n".join(self.entries))

    def get_data(self) -> dict:
        return {
            "start_time": self.start_time.isoformat(),
            "duration_seconds": (datetime.now() - self.start_time).seconds,
            "entries_count": len(self.entries),
            "entries": self.entries,
        }
