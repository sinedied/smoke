import {Eta} from 'eta';

export function render(str, data) {
  const eta = new Eta({useWith: true});
  // Transform legacy lodash.template delimiters to Eta default tags
  const tpl = str
    // {{{ }}} -> escape (HTML-escape) -> <%= %>
    .replaceAll(/{{{([\s\S]+?)}}}/g, '<%=$1%>')
    // {{ }} -> raw (no-escape) -> <%~ %>
    .replaceAll(/{{([\s\S]+?)}}/g, '<%~$1%>')
    // <{ }> -> evaluate -> <% %>
    .replaceAll(/<{([\s\S]+?)}>/g, '<%$1%>');
  return eta.renderString(tpl, data);
}
