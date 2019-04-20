from operator import attrgetter, itemgetter
import os
import re
from collections import defaultdict
import sys
import inspect
from flask_selfdoc import Autodoc

from flask import current_app, render_template, render_template_string, jsonify
from jinja2 import evalcontextfilter, Markup
from jinja2.exceptions import TemplateAssertionError


try:
    from flask import _app_ctx_stack as stack
except ImportError:
    from flask import _request_ctx_stack as stack


if sys.version < '3':
    get_function_code = attrgetter('func_code')
else:
    get_function_code = attrgetter('__code__')


class CustomAutodoc(object):

    def __init__(self, app=None):
        self.app = app
        self.func_groups = defaultdict(set)
        self.func_props = defaultdict()
        self.immutable_props = ['rule', 'endpoint']
        self.default_props = [
            'methods', 'docstring',
            'args', 'defaults', 'location'] + self.immutable_props
        self.func_locations = defaultdict(dict)
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        if hasattr(app, 'teardown_appcontext'):
            app.teardown_appcontext(self.teardown)
        else:
            app.teardown_request(self.teardown)
        self.add_custom_template_filters(app)

    def teardown(self, exception):
        ctx = stack.top  # noqa: F841

    def add_custom_template_filters(self, app):
        """Add custom filters to jinja2 templating engine"""
        self.add_custom_nl2br_filters(app)

    def add_custom_nl2br_filters(self, app):
        """Add a custom filter nl2br to jinja2
         Replaces all newline to <BR>
        """
        _paragraph_re = re.compile(r'(?:\r\n|\r|\n){3,}')

        @app.template_filter()
        @evalcontextfilter
        def nl2br(eval_ctx, value):
            result = '\n\n'.join('%s' % p.replace('\n', Markup('<br>\n'))
                                 for p in _paragraph_re.split(value))
            result = result.replace(' ', Markup('&nbsp;'))
            return result

    def doc(self, groups=None, set_location=True, **properties):
        """Add flask route to autodoc for automatic documentation

        Any route decorated with this method will be added to the list of
        routes to be documented by the generate() or html() methods.

        By default, the route is added to the 'all' group.
        By specifying group or groups argument, the route can be added to one
        or multiple other groups as well, besides the 'all' group.

        If set_location is True, the location of the function will be stored.
        NOTE: this assumes that the decorator is placed just before the
        function (in the normal way).

        Custom parameters may also be passed in beyond groups, if they are
        named something not already in the dict descibed in the docstring for
        the generare() function, they will be added to the route's properties,
        which can be accessed from the template.

        If a parameter is passed in with a name that is already in the dict, but
        not of a reserved name, the passed parameter overrides that dict value.
        """
        def decorator(f):
            # Get previous group list (if any)
            if f in self.func_groups:
                groupset = self.func_groups[f]
            else:
                groupset = set()

            # Set group[s]
            if type(groups) is list:
                groupset.update(groups)
            elif type(groups) is str:
                groupset.add(groups)
            groupset.add('all')
            self.func_groups[f] = groupset
            self.func_props[f] = properties

            # Set location
            if set_location:
                caller_frame = inspect.stack()[1]
                self.func_locations[f] = {
                        'filename': caller_frame[1],
                        'line':     caller_frame[2],
                        }

            return f
        return decorator

    def generate(self, groups='all', sort=None):
        """Return a list of dict describing the routes specified by the
        doc() method

        Each dict contains:
         - methods: the set of allowed methods (ie ['GET', 'POST'])
         - rule: relative url (ie '/user/<int:id>')
         - endpoint: function name (ie 'show_user')
         - doc: docstring of the function
         - args: function arguments
         - defaults: defaults values for the arguments

        By specifying the group or groups arguments, only routes belonging to
        those groups will be returned.

        Routes are sorted alphabetically based on the rule.
        """
        groups_to_generate = list()
        if type(groups) is list:
            groups_to_generate = groups
        elif type(groups) is str:
            groups_to_generate.append(groups)

        links = []
        for rule in current_app.url_map.iter_rules():

            if rule.endpoint == 'static':
                continue

            func = current_app.view_functions[rule.endpoint]
            arguments = rule.arguments if rule.arguments else ['None']
            func_groups = self.func_groups[func]
            func_props = self.func_props[func] if func in self.func_props \
                else {}
            location = self.func_locations.get(func, None)
            if 'HEAD' in rule.methods:
                rule.methods.remove('HEAD')
            if 'OPTIONS' in rule.methods:
                rule.methods.remove('OPTIONS')

            if func_groups.intersection(groups_to_generate):
                props = dict(
                    methods=sorted(list(rule.methods)),
                    rule="%s" % rule,
                    endpoint=rule.endpoint,
                    docstring=func.__doc__,
                    args=arguments,
                    defaults=rule.defaults,
                    location=location,
                )
                for p in func_props:
                    if p not in self.immutable_props:
                        props[p] = func_props[p]
                links.append(props)
        if sort:
            return sort(links)
        else:
            return sorted(links, key=itemgetter('rule'))

    def html(self, groups='all', template=None, **context):
        """Return an html string of the routes specified by the doc() method

        A template can be specified. A list of routes is available under the
        'autodoc' value (refer to the documentation for the generate() for a
        description of available values). If no template is specified, a
        default template is used.

        By specifying the group or groups arguments, only routes belonging to
        those groups will be returned.
        """
        context['autodoc'] = context['autodoc'] if 'autodoc' in context \
            else self.generate(groups=groups)
        context['defaults'] = context['defaults'] if 'defaults' in context \
            else self.default_props
        if template:
            return render_template(template, **context)
        else:
            filename = os.path.join(
                os.path.dirname(__file__),
                'templates',
                'autodoc_default.html'
            )
            with open(filename) as file:
                content = file.read()
                with current_app.app_context():
                    try:
                        return render_template_string(content, **context)
                    except TemplateAssertionError:
                        raise RuntimeError(
                            "Autodoc was not initialized with the Flask app.")

    def json(self, groups='all'):
        """Return a json object with documentation for all the routes specified
        by the doc() method.

        By specifiying the groups argument, only routes belonging to those groups
        will be returned.
        """
        autodoc = self.generate(groups=groups)

        def endpoint_info(doc):
            args = doc['args']
            if args == ['None']:
                args = []
            return {
                "args": [(arg, doc['defaults'][arg]) for arg in args],
                "docstring": doc['docstring'],
                "methods": doc['methods'],
                "rule": doc['rule']
            }
        data = {
            'endpoints':
                [endpoint_info(doc) for doc in autodoc]
        }
        return jsonify(data)


Selfdoc = Autodoc
