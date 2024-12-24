import template from 'lodash.template';

export function render(str, data) {
  return template(str, {
    // {{ }} interpolates
    interpolate: /{{([\s\S]+?)}}/g,
    // {{{ }}} encodes interpolated string
    escape: /{{{([\s\S]+?)}}}/g,
    // <{ }> evaluates
    evaluate: /<{([\s\S]+?)}>/g,
  })(data);
}
