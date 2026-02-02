# config/prompts.py

PROMPTS = {

    # SCENE DEFINE
    "scene_define": {
        "prompt_name": "scene_define",
        "role": "Metteur en scène",
        "role_domain": "cadrage et lumière",
        "expertise_fields": "mise en valeur des émotions subtiles",
        "mission": "donner un titre à ce rêve",
        "goal": "",
        "output_format": {
            "scenario_name": "str"
        },
        "add": ""
    },

    # GET SCENARIO NAME
    "get_scenario_name": {
        "prompt_name": "get_scenario_name",
        "role": "Concepteur de scénarios de réalisation de rêves",
        "role_domain": "structuration narrative et analyse de parcours d’accomplissement",
        "expertise_fields": [
            "décomposition d’objectifs en étapes réalistes",
            "identification de scènes typiques et incontournables",
            "hiérarchisation préparatifs / déroulé / accomplissement / effets",
            "cohérence narrative orientée résultat",
            "alignement strict avec l’intention exprimée par l’utilisateur",
            "élimination des scènes hors-sujet ou mal positionnées"
        ],
        "prompt_goal": "Pour chacune de ces étapes de la réalisation d'un rêve, propose 5 situations caractéristiques et typiques :\n\n1 - préparatifs (ce qui se passe nécessairement en amont de cet accomplissement)\n2 - déroulé (ce qui se passe pendant la concrétisation)\n3 - accomplissement (ce qui se passe à l'instant précis de l'accomplissement)\n4 - effets (ce que ça permet de vivre)",
        "relevant_examples": "Pour le rêve 'remporter le 100 mètres', les scènes incontournables évidentes pourraient être :\n\n1 : des étirements\n2 : le personnage court sur la piste\n3 : le personnage franchit la ligne d'arrivée\n4 : le personnage est sur la plus haute marche du podium",
        "irrelevant_examples": "Pour le rêve 'remporter le 100 mètres', des scènes non pertinentes pourraient être :\n\n- le personnage avec son chien → aucun rapport avec le rêve\n- le personnage sur les starting blocks à l'étape 4 → mal positionné\n- le personnage franchit la ligne d'arrivée derrière un autre coureur → l'accomplissement doit montrer la réussite",
        "output_format": {
            "scenes": "dict"
        },
        "add": "{add_feedback}"
    },

    # VALIDATION
    "validation": {
        "prompt_name": "validation",
        "role": "Évaluateur de réponses IA",
        "role_domain": "évaluation critique de productions IA",
        "expertise_fields": [
            "comparaison stricte entre le prompt et la réponse",
            "détection des écarts d’intention et de hors-sujet",
            "analyse de la cohérence interne de la réponse",
            "vérification du respect des contraintes explicites et implicites",
            "évaluation neutre sans extrapolation ni interprétation externe",
            "capacité à produire un scoring reproductible et stable"
        ],
        "mission": """Voici le prompt qu'on a donné à un agent IA, suivi de sa réponse :

### PROMPT ###
{prompt}

### AGENT ANSWER ###
{response}

Note sa réponse de 1 à 5 sur ces paramètres (décimales autorisées) :

- pertinence
- complétude
- respect des contraintes
- cohérence interne
- clarté
- précision

Justifie chaque note qui n’est pas maximale.
""".strip(),
        "goal": "Produire une évaluation structurée, objective et exploitable de la réponse d’un agent IA.",
        "relevant_examples": "...",
        "irrelevant_examples": "...",
        "output_format": {
            "pertinence": {"note": "float", "explanation": "str"},
            "completude": {"note": "float", "explanation": "str"},
            "respect_des_contraintes": {"note": "float", "explanation": "str"},
            "coherence_interne": {"note": "float", "explanation": "str"},
            "clarte": {"note": "float", "explanation": "str"},
            "precision": {"note": "float", "explanation": "str"}
        },
        "add": ""
    }
}


def get_prompt(prompt_name: str) -> dict:
    if prompt_name not in PROMPTS:
        raise KeyError(f"Prompt '{prompt_name}' introuvable")
    return PROMPTS[prompt_name]
