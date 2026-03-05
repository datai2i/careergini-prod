from latex_generator import setup_jinja_env
env = setup_jinja_env("latex_templates")
env.get_template("deedy.tex.j2")
