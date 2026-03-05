from jinja2 import Environment, FileSystemLoader
import sys

env = Environment(
    loader=FileSystemLoader("latex_templates"),
    block_start_string='\\BLOCK{',
    block_end_string='}',
    variable_start_string='\\VAR{',
    variable_end_string='}',
    comment_start_string='\\#{',
    comment_end_string='}'
)
try:
    env.get_template("deedy.tex.j2")
except Exception as e:
    import traceback
    traceback.print_exc()
