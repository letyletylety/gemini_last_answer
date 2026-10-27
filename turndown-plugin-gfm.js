var turndownPluginGfm = (function (exports) {
'use strict';

var highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/;

function highlightedCodeBlock (turndownService) {
  turndownService.addRule('highlightedCodeBlock', {
    filter: function (node) {
      var firstChild = node.firstChild;
      return (
        node.nodeName === 'DIV' &&
        highlightRegExp.test(node.className) &&
        firstChild &&
        firstChild.nodeName === 'PRE'
      )
    },
    replacement: function (content, node, options) {
      var className = node.className || '';
      var language = (className.match(highlightRegExp) || [null, ''])[1];

      return (
        '\n\n' + options.fence + language + '\n' +
        node.firstChild.textContent +
        '\n' + options.fence + '\n\n'
      )
    }
  });
}

function strikethrough (turndownService) {
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: function (content) {
      return '~' + content + '~'
    }
  });
}

var indexOf = Array.prototype.indexOf;
var every = Array.prototype.every;
var rules = {};

rules.tableCell = {
  filter: ['th', 'td'],
  replacement: function (content, node) {
    var cleanContent = content
      .trim()
      .replace(/(?<!\\)\|/g, '\\|')
      .replace(/\r?\n+/g, '<br>');
    return cell(cleanContent, node);
  }
};

rules.tableRow = {
  filter: 'tr',
  replacement: function (content, node) {
    var borderCells = '';
    var alignMap = { left: ':--', right: '--:', center: ':-:' };

    if (isHeadingRow(node)) {
      var cells = Array.prototype.filter.call(node.childNodes, function (n) {
        return n.nodeName === 'TH' || n.nodeName === 'TD';
      });
      for (var i = 0; i < cells.length; i++) {
        var border = '---';
        var align = (
          cells[i].getAttribute('align') || ''
        ).toLowerCase();

        if (align) border = alignMap[align] || border;

        borderCells += cell(border, cells[i]);
      }
    }

    var trimmed = content.trim();
    if (!trimmed || /^(\||\s)+$/.test(trimmed)) {
      return borderCells ? '\n' + borderCells : '';
    }

    return '\n' + content + (borderCells ? '\n' + borderCells : '');
  }
};

rules.table = {
  filter: function (node) {
    return node.nodeName === 'TABLE' && (isHeadingRow(node.rows[0]) || (node.rows && node.rows.length > 0));
  },

  replacement: function (content) {
    content = content
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; })
      .join('\n');
    return '\n\n' + content + '\n\n';
  }
};

rules.tableSection = {
  filter: ['thead', 'tbody', 'tfoot'],
  replacement: function (content) {
    return content;
  }
};

function isHeadingRow (tr) {
  if (!tr) return false;
  var parentNode = tr.parentNode;
  if (parentNode.nodeName === 'THEAD') return true;
  var cells = Array.prototype.filter.call(tr.childNodes, function (n) {
    return n.nodeName === 'TH' || n.nodeName === 'TD';
  });
  if (cells.length > 0 && cells.every(function (n) { return n.nodeName === 'TH'; })) {
    return true;
  }
  var table = tr.closest ? tr.closest('table') : null;
  if (!table) {
    var p = parentNode;
    while (p && p.nodeName !== 'TABLE') p = p.parentNode;
    table = p;
  }
  if (table && !table.querySelector('thead')) {
    var firstTr = table.querySelector('tr');
    if (firstTr === tr) return true;
  }
  return false;
}

function isFirstTbody (element) {
  var previousSibling = element.previousSibling;
  return (
    element.nodeName === 'TBODY' && (
      !previousSibling ||
      (
        previousSibling.nodeName === 'THEAD' &&
        /^\s*$/i.test(previousSibling.textContent)
      )
    )
  );
}

function cell (content, node) {
  var parent = node.parentNode;
  var cells = Array.prototype.filter.call(parent.childNodes, function (n) {
    return n.nodeName === 'TH' || n.nodeName === 'TD';
  });
  var index = indexOf.call(cells, node);
  var prefix = ' ';
  if (index === 0) prefix = '| ';
  return prefix + content + ' |';
}

function tables (turndownService) {
  for (var key in rules) turndownService.addRule(key, rules[key]);
}

function taskListItems (turndownService) {
  turndownService.addRule('taskListItems', {
    filter: function (node) {
      return node.type === 'checkbox' && node.parentNode.nodeName === 'LI'
    },
    replacement: function (content, node) {
      return (node.checked ? '[x]' : '[ ]') + ' '
    }
  });
}

function gfm (turndownService) {
  turndownService.use([
    highlightedCodeBlock,
    strikethrough,
    tables,
    taskListItems
  ]);
}

exports.gfm = gfm;
exports.highlightedCodeBlock = highlightedCodeBlock;
exports.strikethrough = strikethrough;
exports.tables = tables;
exports.taskListItems = taskListItems;

return exports;

}({}));