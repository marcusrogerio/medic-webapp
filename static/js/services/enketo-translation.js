var _ = require('underscore');

function withElements(nodes) {
  return _.chain(nodes)
    .filter(function(n) {
      return n.nodeType === Node.ELEMENT_NODE;
    });
}

function without() {
  var unwanted = Array.prototype.slice.call(arguments, 0);
  return function(n) {
    return !_.contains(unwanted, n.nodeName);
  };
}

function findChildNode(root, childNodeName) {
  return withElements(root.childNodes)
      .find(function(n) {
        return n.nodeName === childNodeName;
      })
      .value();
}

function xPath() {
  var path = Array.prototype.slice.call(arguments).join('/');
  return '/data/' + path;
}

/**
 * An internal representation of an XML node.
 */
function N(tagName, text, attrs, children) {
  var self = this;
  self.tagName = tagName;
  if(arguments.length === 2) {
    if(_.isArray(text)) {
      children = text; text = null;
    } else if(typeof text === 'object') {
      attrs = text; text = null;
    }
  } else if(arguments.length === 3) {
    if(_.isArray(attrs)) {
      children = attrs; attrs = null;
      if(typeof text === 'object') {
        attrs = text;
        text = null;
      }
    }
  }

  self.text = text;
  self.attrs = attrs || {};
  self.children = children || [];

  self.prepend = function(child) {
    self.children.unshift(child);
  };

  self.append = function(child_or_children) {
    if(_.isArray(child_or_children)) {
      self.children = self.children.concat(child_or_children);
    } else {
      self.children.push(child_or_children);
    }
  };

  self.appendTo = function(parent) {
    parent.children.push(self);
  };

  self.xml = function() {
    var xml = '<' + self.tagName;
    _.each(Object.keys(self.attrs).sort(), function(key) {
      xml += ' ' + key + '="' + self.attrs[key] + '"';
    });
    if(self.text || self.children.length) {
      xml += '>';
      if(self.text) {
        xml += self.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
      }
      if(self.children) {
        _.each(self.children, function(child) {
          xml += child.xml();
        });
      }
      xml += '</' + tagName + '>';
    } else {
      xml += '/>';
    }
    return xml;
  };
}


angular.module('inboxServices').service('EnketoTranslation', [
  '$translate', '$log',
  function($translate, $log) {
    var self = this;

    function extraAttributesFor(conf) {
      var extras = {};
      var typeString = conf.type;
      if(typeString === 'text') {
        extras.appearance = 'multiline';
      } else if(/^db:/.test(typeString)) {
        extras.appearance = 'db-object bind-id-only';
      }
      return extras;
    }

    function getBindingType(conf) {
      return conf.type;
    }

    function translationFor() {
      var key = Array.prototype.slice.call(arguments).join('.');
      return $translate.instant(key);
    }

    function modelFor(schema, rootNode) {
      var node = new N(rootNode || schema.type);
      _.each(schema.fields, function(conf, name) {
        node.append(new N(name));
      });
      return node;
    }

    self.generateXform = function(principle, extras) {
      var root = new N('h:html', {
        xmlns: 'http://www.w3.org/2002/xforms',
        'xmlns:ev': 'http://www.w3.org/2001/xml-events',
        'xmlns:h': 'http://www.w3.org/1999/xhtml',
        'xmlns:jr': 'http://openrosa.org/javarosa',
        'xmlns:orx': 'http://openrosa.org/xforms/',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
      });

      var head = (function generateHead() {
        var head = new N('h:head');
        var model = new N('model');
        head.append(model);
        var instance = new N('instance');
        model.append(instance);

        var instanceContainer = new N('data', { id:principle.type, version:1 });
        instanceContainer.append(modelFor(principle));
        if(extras) {
          _.each(extras, function(extra, mapping) {
            instanceContainer.append(modelFor(extra, mapping));
          });
        }
        // add some meta (not sure what this is for)
        instanceContainer.append(new N('meta', [ new N('instanceID') ]));

        instance.append(instanceContainer);

        // bindings
        var bindingsFor = function(schema, mapping) {
          _.each(schema.fields, function(conf, f) {
            if (conf.hide_in_form) {
              return;
            }
            var props = {
              nodeset: xPath(mapping, f),
              type: getBindingType(conf),
            };
            if(conf.required) {
              props.required = 'true()';
            }
            model.append(new N('bind', props));
          });
        };
        bindingsFor(principle, principle.type);
        _.each(extras, function(extra, mapping) {
          model.append(new N('bind', { nodeset: xPath(mapping), relevant: xPath(principle.type, mapping) + ' = \'NEW\'' }));
          bindingsFor(extra, mapping);
        });

        return head;
      }());
      root.append(head);

      var body = (function generateBody() {
        // N.B. we may not want pages for single-object forms
        var body = new N('h:body');
        if(extras) {
          body.attrs.class = 'pages';
        }

        var groupFor = function(schema, mapping) {
          return new N('group',
              { appearance: 'field-list', ref: xPath(mapping) },
              fieldsFor(schema, mapping));
        };

        var fieldsFor = function(schema, mapping) {
          var fields = [];
          _.each(schema.fields, function(conf, f) {
            if (conf.hide_in_form) {
              return;
            }
            var attrs = _.extend({ ref: xPath(mapping, f) }, extraAttributesFor(conf));
            if (extras && extras.hasOwnProperty(f)) {
              if (attrs.appearance) {
                attrs.appearance += ' allow-new';
              } else {
                attrs.appearance = 'allow-new';
              }
            }
            var input = new N('input', attrs);
            input.append(new N('label', translationFor(schema.type, 'field', f)));
            fields.push(input);
          });
          return fields;
        };

        if(extras) {
          body.append(groupFor(principle, principle.type));
        } else {
          body.append(fieldsFor(principle, principle.type));
        }

        _.each(extras, function(extra, mapping) {
          var group = groupFor(extra, mapping);
          group.prepend(new N('label', translationFor('contact.type', extra.type, 'new')));
          body.append(group);
        });

        return body;
      }());
      root.append(body);

      return root.xml();
    };

    self.getHiddenFieldList = function(model) {
      model = $.parseXML(model).firstChild;
      return model && withElements(model.childNodes)
        .filter(function(n) {
          var attr = n.attributes.getNamedItem('tag');
          return attr && attr.value === 'hidden';
        })
        .map(function(n) {
          return n.nodeName;
        })
        .value();
    };

    var nodesToJs = function(data) {
      var fields = {};
      withElements(data)
        .each(function(n) {
          var hasChildren = withElements(n.childNodes).size().value();
          if(hasChildren) {
            fields[n.nodeName] = nodesToJs(n.childNodes);
          } else {
            fields[n.nodeName] = n.textContent;
          }
        });
      return fields;
    };

    // TODO repeat-relevant may be unnecessary if https://github.com/enketo/enketo-core/issues/336 is resolved
    var repeatsToJs = function(data) {
      var repeatNode = findChildNode(data, 'repeat');
      if(!repeatNode) {
        return;
      }

      var repeatRelevantNode = findChildNode(data, 'repeat-relevant');
      var repeats = {};

      withElements(repeatNode.childNodes)
        .each(function(repeated) {
          if(repeatRelevantNode) {
            var repeatedRelevant = findChildNode(repeatRelevantNode, repeated.nodeName);
            if(repeatedRelevant && repeatedRelevant.textContent !== 'true') {
              return;
            }
          }

          var key = repeated.nodeName + '_data';
          if(!repeats[key]) {
            repeats[key] = [];
          }
          repeats[key].push(nodesToJs(repeated.childNodes));
        });

      return repeats;
    };

    self.reportRecordToJs = function(record) {
      var root = $.parseXML(record).firstChild;
      return nodesToJs(root.childNodes);
    };

    self.contactRecordToJs = function(record) {
      var root = $.parseXML(record).firstChild;
      var repeats = repeatsToJs(root);
      var siblings = {};
      var first = null;
      withElements(root.childNodes)
        // TODO repeat-relevant may be unnecessary if https://github.com/enketo/enketo-core/issues/336 is resolved
        .filter(without('meta', 'inputs', 'repeat', 'repeat-relevant'))
        .each(function(child) {
          if(!first) {
            first = child;
            return;
          }
          siblings[child.nodeName] = nodesToJs(child.childNodes);
        });
      var res = [ nodesToJs(first.childNodes), siblings ];
      if(repeats) {
        res.push(repeats);
      }
      return res;
    };

    var findCurrentElement = function(elem, name, childMatcher) {
      if (childMatcher) {
        var found = elem.find(childMatcher(name));
        if (found.length > 1) {
          $log.warn('Using the matcher "' + childMatcher() + '" we found ' + found.length + ' elements, ' +
            'we should only ever bind one.', elem);
        }
        return found;
      } else {
        return elem.children(name);
      }
    };

    // NB: childMatcher intentionally does not recurse.
    //     It exists to allow the initial layer of binding to be flexible.
    self.bindJsonToXml = function(elem, data, childMatcher) {
      _.pairs(data).forEach(function(pair) {
        var current = findCurrentElement(elem, pair[0], childMatcher);
        var value = pair[1];

        if (_.isObject(value)) {
          if(current.children().length) {
            self.bindJsonToXml(current, value);
          } else {
            current.text(value._id);
          }
        } else {
          current.text(value);
        }
      });
    };

  }
]);
