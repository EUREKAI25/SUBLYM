from functions.session_store import SESSION
from functions.trace_id_generate import trace_id_generate
from config.models import model_execute
from config.config import PROMPTS
from config.prompts import get_prompt

session = SESSION
dream = "Je rêve d'aller à Rome"
session["dream"]= dream




## UTILS
def set_session(data): 
    for key, value in data:
        if not session["key"]:
            session[key] = value
def add_session(key, value):
    if not session[key]:
        session[key]= value
def update_session(item):
    for key, value in item:
        session[key]= value
def expose_session(session):
    for key, var in session:
        f"{var}" = var
## AI ACTIONS
def AI_tell(prompt, promptparams):
    action = "tell"
    model = "texttext"
    result = model_execute(model, prompt)
    session["action"] = action
    session["prompt"] = prompt
    session["result"] = result
    session["model"] = model
    if not result.success :
        prompt.add = result.explanation
def AI_check():
    # on checke pertinence etc
    prompt = get_prompt("get_scenario_name")

    action = "check"
    session["action"] = action
    session["prompt"] = prompt
    session["result"] = result
    session["model"] = model

    print (f"on vérifie le résultat fourni pour le dernier prompt {action} ")

    pass
def AI_compare(options, choice_params):
    # on checke pertinence etc
    action = "compare"
    AI_promptexecute (prompt, action, model)

    print (f"on vérifie le résultat fourni pour le dernier prompt {action}")

    pass
def AI_choose(options, choice_params):
    # on checke pertinence etc
    action = "choose"
    prompt= 
    AI_promptexecute (prompt, action, model)

    print (f"on vérifie le résultat fourni pour le dernier prompt {action}")

    pass
def AI_promptexecute (prompt, action, model):
    context = prompt.context
    role= prompt.role
    role_domain= prompt.role_domain
    expertise_fields= prompt.expertise_fields
    mission= prompt.mission
    goal= prompt.goal
    output_format= prompt.output_format
    add = getattr(prompt, "add", "") or ""
    params = {context, role, role_domain, expertise_fields, mission, goal, output_format, add}
    result = model_execute(model, params)
    update_session("prompt") = prompt
    update_session("result") = result
    update_session("action") = action
    update_session("model") = model
    action_result = action_validate()
    update_session("history", action_result)
    return (result)


## EURKAI
def action_validate():
    # ça suffit, pour accéder aux variables sesions exposées ?
    action = session["action"]
    prompt = session["prompt"]
    result = session["result"]
    lastaction=[action, prompt, result]
    verification = AI_check(lastaction)
    if not verification.result:
        verification.next
    print(f"verificaion {verification}")
    return verification

## STEPS        
def set_scenario_name():
    set_scenario_name = get_scenario_name(dream)
    set_session(set_scenario_name)
def set_trace_id() :
    trace_id = trace_id_generate()
    set_session(trace_id)
def step_define(dream):
    prompt = "step_define"
    result = AI_tell(prompt)
    if not result.success :
        prompt.add = result.explanation # je veux que le template prompt prévoie une zone Addendum
def set_scenario_params():
    pass

def keyframes_create():
    pass

def set_scenario_pitch():
    pass

def scenario_create():
    scenario = ""
    set_session("scenario", dict)
    scenario["name"] = set_scenario_name()
    scenario["params"] = set_scenario_params()
    scenario["pitch"] = set_scenario__pitch()
    scenario["steps"] = step_define()
    scenario["keyframes"] = keyframes_create()
    scenario["name"] = set_scenario_name()
    scenario["name"] = set_scenario_name()
    update_sessions("scenario", scenario)
    set_trace_id()
    
def set_scenario_params():
    scenario_params["color_palet"] = palet_define(prompt)

    steps = {
        "set_scenario_name" : {"output_format": {"scenario_name": str}},
        "set_scenario_params" :  {"output_format": { "shooting_brief", "acting_brief", "paletcolor"}},
        "step_define" : {"output_format": {"steps": dict}},  #on liste les étapes du scénario get_scenario_steps
        "keyframes_create": {"output_format": {"keyframes": {"name": str, "params": dict}}}, # {"scenario_pitch": list}, #pitch amélioré    get_scenario_pitch
        "palet_define" : {"global_palet": list},
        "steps_parameters": bool
    }

def app_execute():
    steps = {
        "set_scenario_name" : {"output_format": {"scenario_name": str}},
        "set_trace_id" :  {"output_format": {"trace_id": str}},
        "step_define" : {"output_format": {"steps": dict}, "next": {"action": "validate"}}, #on liste les étapes du scénario get_scenario_steps
        "scenario_create": "", # {"scenario_pitch": list}, #pitch amélioré    get_scenario_pitch
        "palet_define" : {"global_palet": list}
    }
    pass

def get_scenario_name(dream):
    scenario_name = model_execute("texttext", prompt)
    set_session({"scenario_name": scenario_name})
    pass
def get_scenario_steps(dream):
    steps = {"step": {"pitch": str}}
    set_session(steps)
    pass
def get_scenario_pitch(dream, steps):
    # return (pitch)
    pass
def get_palet(details):
    # return(global_color_palet)
    pass
def get_step_details(step, global_color_palet): 
    step_when =  {"season", "year", "hour", "month", "event", "details"}
    step_where =  {"country", "town", "scenery", "details"}
    step_emotions =  {"global", "characterA", "others"}

    step_colors = get_palet(step.pitch, step_when, step_where, step_emotions, global_color_palet)

    step_details = {
        "when":step_when,
        "where": step_where,
        "emotions" : step_emotions,
        "colors" : step_colors
    }
    # return (step_details)
    pass
    
def set_session_history(steps):
    for step in steps:
        , "status": str "to do" 
def get_session_history():
    for step in scenario_history :
        f"- {step.name} : "

expose_session()
set_session({"dream", dream})
set_session({"steps", steps})

for step in steps :
    step_define(step)
    # pour chaque étape on définit 
    # les personnages présents, l'heure et le lieu (pays ville rome), le scenery int / ext
    # l'émotion voulue pour char A, get_step_details
    # les couleurs déclinées de la palette de base (color_decline(hour, scenery) -> adapte cette palette 
    # à l'heure et le contexte int/ext)

if not history :
    pass

update_session("action") 
{
    "name" = "global_prompt",
    "params" = {
        "history" : history,
        "context" : """On crée une app qui met en scène sous forme de vidéo le rêve exprimé par l'utilisateur\n
        Tu trouveras ci-dessous le rêve de l'utilisateur, de façon à lui permettre d'activer la loi d'attraction\n
        grâce aux émotions fortes que la vidéo va déclencher.\n
        Pour ça nous allons procéder par étapes :n
        {history}
        """.strip(),
        "params" : params
    }
}


 # pour chacun des briques on exécute le prompt, on fait choisir une option ou évaluer la réponse
 # à chaque fois on met l'historique en session et on le fournit à l'agent


def set_scenario(dream, ):
    pass