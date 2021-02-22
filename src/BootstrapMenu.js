'use strict';

var classNames = require('classnames');
var $ = require('jquery');
require('jquery-ui/ui/position');

// modular lodash requires
var _ = function() {
  throw new Error('Custom lodash build for BootstrapMenu. lodash chaining is not included');
};

_.noop = require('lodash/utility/noop');
_.each = require('lodash/collection/each');
_.contains = require('lodash/collection/contains');
_.extend = require('lodash/object/extend');
_.uniqueId = require('lodash/utility/uniqueId');
_.isFunction = require('lodash/lang/isFunction');


var defaultOptions = {
    /* container of the context menu, where it will be created and where
     * event listeners will be installed. */
    container: 'body',

    /* user-defined function to obtain specific data about the currently
     * opened element, to pass it to the rest of user-defined functions
     * of an action. */
    fetchElementData: _.noop,

    /* what the source of the context menu should be when opened.
     * Valid values are 'mouse' and 'element'. */
    menuSource: 'mouse',

    /* how to calculate the position of the context menu based on its source.
     * Valid values are 'aboveLeft', 'aboveRight', 'belowLeft', and 'belowRight'. */
    menuPosition: 'belowLeft',

    /* the event to listen to open the menu.
     * Valid values are 'click', 'right-click', 'hover' */
    menuEvent: 'right-click', // TODO rename to menuAction in next mayor version

    /* message to show when there are no actions to show in a menu
     * (isShown() returned false on all actions) */
    noActionsMessage: 'No available actions',

    /* In some weird cases, another plugin may be installing 'click' listeners
     * in the anchors used for each action of the context menu, and stopping
     * the event bubbling before it reachs this plugin's listener.
     *
     * For those cases, _actionSelectEvent can be used to change the event we
     * listen to, for example to 'mousedown'.
     *
     * Unless the context menu is not working due to this and a workaround is
     * needed, this option can be safely ignored.
     */
    _actionSelectEvent: 'click'
};

function renderMenu(_this) {
    var $menu = $('<div class="dropdown bootstrapMenu" style="z-index:10000;position:absolute;" />'),
        $ul = $('<ul class="dropdown-menu" style="position:static;display:block;font-size:0.9em;" />'),
        html = '',
        index = 0;

    _.each(_this.options.actions, function(action) {

        if (action.header !== undefined) {
          html = '<li class="nav-header">' + action.header + '</li>';
        }
        else if (action.divider !== undefined)
        {
            html = '<li class="divider"></li>';
        }
        else
        {
            // Start tag
            html = '<li role="menu" data-menu-item="' + index + '"';
            if ( action.subMenuItems !== undefined ) {
              html += ' class="dropdown-submenu"';
            }
            html += '>';

            // Add Link
            html += '<a href="#" role="menuitem">';
            // Add Icon
            html += '<i class="fa"></i> ';
            // Add Name
            html += '<span class="actionName"></span></a>';

            _this.flatItemIndex.push(action);
            index++;

            // If has subMenuItems, add submenu class
            if ( action.subMenuItems !== undefined ) {
                html += '<ul class="dropdown-menu">';

                if ( typeof action.subMenuItems === 'object' && action.subMenuItems.length ) {
                    _.each(action.subMenuItems, function(subMenuItem) {
                        if (subMenuItem.header !== undefined) {
                          html = '<li class="nav-header">' + subMenuItem.header + '</li>';
                        }
                        else if ( subMenuItem.divider !== undefined )
                        {
                            html += '<li class="divider"></li>';
                        }
                        else
                        {
                            // Start tag
                            html += '<li role="menu" data-menu-item="' + index + '">';
                            // Link
                            html += '<a href="#" role="menuitem">';
                            // Icon
                            if (subMenuItem.iconClass !== undefined && typeof subMenuItem.iconClass === 'string' ) {
                                html += '<i class="fa fa-fw ' + subMenuItem.iconClass + '"></i> ';
                            }
                            html += '<span class="actionName"></span></a>';
                            // end tag
                            html += '</li>';
                            subMenuItem.isSubaction = true;
                            _this.flatItemIndex.push(subMenuItem);
                            index++;
                        }
                    });
                }

                html += '</ul>';
            }

            // End tag
            html += '</li>';
        }

        // Add to list
        $ul.append(html);
    });

    $ul.append(
        '<li role="menu" class="noActionsMessage hide disabled">' +
        '<a href="#" role="menuitem">' +
        '<span>' + _this.options.noActionsMessage + '</span>' +
        '</a>' +
        '</li>'
    );

    $menu.append($ul);

    return $menu;
}

function setupOpenEventListeners(_this) {
    var openEventName = null;

    switch (_this.options.menuEvent) {
        case 'click':
            openEventName = 'click';
            break;
        case 'right-click':
            openEventName = 'contextmenu';
            break;
        case 'hover':
            openEventName = 'mouseenter';
            break;
        default:
            throw new Error("Unknown BootstrapMenu 'menuEvent' option");
    }

    // install the handler for every future elements where
    // the context menu will open
    _this.$container.on(openEventName + _this.namespace, _this.selector, function(evt) {
        var $openTarget = $(this);

        _this.open($openTarget, evt);

        // cancel event propagation, to avoid it bubbling up to this.$container
        // and closing the context menu as if the user clicked outside the menu.
        return false;
    });
}

function clearOpenEventListeners(_this) {
    _this.$container.off(_this.namespace);
}

function setupActionsEventListeners(_this) {
    var actionSelectEvent = _this.options._actionSelectEvent + _this.namespace;

    // handler to run when an option is selected
    _this.$menu.on(actionSelectEvent, function(evt) {
        evt.preventDefault();
        evt.stopPropagation();

        var $target = $(evt.target);
        var $action = $target.closest('[data-menu-item]');

        // check if the clicked element is an action, and its enabled.
        // if not don't do anything
        if (!$action || !$action.length || $action.is('.disabled')) {
            return;
        }

        var index = $action.data('menu-item');
        var targetData = _this.options.fetchElementData(_this.$openTarget);

        /* call the user click handler. It receives the optional user-defined data,
         * or undefined. */
        if (_this.flatItemIndex[index].onClick !== undefined) {
            _this.flatItemIndex[index].onClick(targetData);
        }

        // close the menu
        _this.close();
    });
}

function clearActionsEventListeners(_this) {
    _this.$menu.off(_this.namespace);
}

function setupCloseEventListeners(_this) {
    switch (_this.options.menuEvent) {
        case 'click':
            break;
        case 'right-click':
            break;
        case 'hover':
            // close the menu when the mouse is moved outside both
            // the element where the context menu was opened, and
            // the context menu itself.
            var $elemsToCheck = _this.$openTarget.add(_this.$menu);

            $elemsToCheck.on('mouseleave' + _this.closeNamespace, function(evt) {
                var destElement = evt.toElement || evt.relatedTarget;
                if (!_this.$openTarget.is(destElement) && !_this.$menu.is(destElement)) {
                    $elemsToCheck.off(_this.closeNamespace);
                    _this.close();
                }
            });
            break;
        default:
            throw new Error("Unknown BootstrapMenu 'menuEvent' option");
    }

    // it the user clicks outside the context menu, close it.
    _this.$container.on('click' + _this.closeNamespace, function() {
        _this.close();
    });
}

function clearCloseEventListeners(_this) {
    _this.$container.off(_this.closeNamespace);
}

var BootstrapMenu = function(selector, options) {
    this.selector = selector;
    this.flatItemIndex = [];
    this.options = _.extend({}, defaultOptions, options);

    // namespaces to use when registering event listeners
    this.namespace = _.uniqueId('.BootstrapMenu_');
    this.closeNamespace = _.uniqueId('.BootstrapMenuClose_');

    this.init();
};

var existingInstances = [];

BootstrapMenu.prototype.init = function() {
    this.$container = $(this.options.container);

    // jQuery object of the rendered context menu. Not part of the DOM yet.
    this.$menu = renderMenu(this);
    this.$menuList = this.$menu.children();

    /* append the context menu to <body> to be able to use "position: absolute"
     * absolute to the whole window. */
    this.$menu.hide().appendTo(this.$container);

    /* the element in which the context menu was opened. Updated every time
     * the menu is opened. */
    this.$openTarget = null;

    /* event that triggered the context menu to open. Updated every time
     * the menu is opened. */
    this.openEvent = null;

    setupOpenEventListeners(this);

    setupActionsEventListeners(this);

    // keep track of all the existing context menu instances in the page
    existingInstances.push(this);
};

BootstrapMenu.prototype.updatePosition = function() {
    var menuLocation = null; // my
    var relativeToElem = null; // of
    var relativeToLocation = null; // at

    switch (this.options.menuSource) {
        case 'element':
            relativeToElem = this.$openTarget;
            break;
        case 'mouse':
            relativeToElem = this.openEvent;
            break;
        default:
            throw new Error("Unknown BootstrapMenu 'menuSource' option");
    }

    switch (this.options.menuPosition) {
        case 'belowRight':
            menuLocation = 'right top';
            relativeToLocation = 'right bottom';
            break;
        case 'belowLeft':
            menuLocation = 'left top';
            relativeToLocation = 'left bottom';
            break;
        case 'aboveRight':
            menuLocation = 'right bottom';
            relativeToLocation = 'right top';
            break;
        case 'aboveLeft':
            menuLocation = 'left bottom';
            relativeToLocation = 'left top';
            break;
        default:
            throw new Error("Unknown BootstrapMenu 'menuPosition' option");
    }

    // update the menu's height and width manually
    this.$menu.css({ display: 'block' });

    // once the menu is not hidden anymore, we can obtain its content's height and width,
    // to manually update it in the menu
    this.$menu.css({
        height: this.$menuList.height(),
        width: this.$menuList.width()
    });

    this.$menu.position({ my: menuLocation, at: relativeToLocation, of: relativeToElem });

    // set submenus to show left if they will display out of screen bounds to the right
    this.$menu.find('.dropdown-submenu').removeClass('pull-left');
    if ( ( this.$menu.position().left + ( this.$menuList.width() * 2 ) ) > $(window).width() )
    {
        this.$menu.find('.dropdown-submenu').addClass('pull-left');
    }
};

// open the context menu
BootstrapMenu.prototype.open = function($openTarget, event) {
    var _this = this;

    // first close all open instances of opened context menus in the page
    BootstrapMenu.closeAll();

    this.$openTarget = $openTarget;

    this.openEvent = event;

    var targetData = _this.options.fetchElementData(_this.$openTarget);

    var $actions = this.$menu.find('[data-menu-item]'),
        $noActionsMsg = this.$menu.find('.noActionsMessage');

    // clear previously hidden actions, and hide by default the 'No actions' message
    $actions.show();

    var numShown = 0;

    /* go through all actions to update the text to show, which ones to show
     * enabled/disabled and which ones to hide. */
     $actions.each(function(i, action) {
        var $action = $(this);
        var actionIndex = $action.data('menu-item');
        var action = _this.flatItemIndex[actionIndex];
        var baseClasses = $action.attr('class');
        var customClasses = action.classNames;

        // Merge base and custom classes
        if (customClasses && _.isFunction(customClasses))
            customClasses = classes(targetData);

        var outputClasses = classNames(baseClasses,customClasses);

        if ( outputClasses.length )
        {
          $action.attr('class', outputClasses);
        }

        if (action.isShown && action.isShown(targetData) === false) {
            $action.hide();
            return;
        } else {
            numShown++;
        }

        // the name provided for an action may be dynamic, provided as a function
        $action.find('.actionName').html(
            _.isFunction(action.name) && action.name(targetData) || action.name
        );

        // Update Icon dynamically
        if ( action.iconClass !== undefined )
        {
            var iconClass = _.isFunction(action.iconClass) && action.iconClass(targetData) || action.iconClass
        }

        if ( iconClass !== undefined )
        {
            $action.find('.fa').attr('class','fa fa-fw ' + iconClass );
        };

        // Update subactions dynamically, if provided as a function
        if (_.isFunction(action.subactions) && action.subactions(targetData)) {

            var subactions = action.subactions(targetData),
                $ul = $action.find('ul.dropdown-menu'),
                li = '',
                $li;

            $ul.empty();

            if ( typeof subactions === 'object' && subactions.length ) {
                _.each(subactions, function(subaction) {

                    li = '';
                    if ( subaction.header !== undefined )
                    {
                        li += '<li class="dropdown-header">' + subaction.header + '</li>';
                    }
                    else if ( subaction.divider !== undefined )
                    {
                        li += '<li class="divider"></li>';
                    }
                    else
                    {
                        // Start tag
                        li += '<li role="menu">';
                        // Link
                        li += '<a href="#" role="action">';
                        // Icon
                        if ( subaction.iconClass !== undefined ) {
                            li += '<i class="fa fa-fw ' + subaction.iconClass + '"></i> ';
                        }
                        li += '<span class="actionName">' + subaction.name + '</span></a>';
                        // end tag
                        li += '</li>';
                    }

                    $li = $(li);
                    if ( subaction.onClick !== undefined )
                    {
                      $li.find('a').click(subaction.onClick);
                    }
                    $li.appendTo($ul);
                });
            }
        }

        if ( action.isEnabled && action.isEnabled(targetData) === false ) {
            $action.addClass('disabled');
        }

    });

    if (numShown === 0) {
        $noActionsMsg.removeClass('hide');
    }

    // once it is known which actions are or arent being shown
    // (so we know the final height of the context menu),
    // calculate its position
    this.updatePosition();

    this.$menu.show();

    setupCloseEventListeners(this);
};

// close the context menu
BootstrapMenu.prototype.close = function() {
    // hide the menu
    this.$menu.hide();

    clearCloseEventListeners(this);
};

BootstrapMenu.prototype.destroy = function() {
    this.close();
    clearOpenEventListeners(this);
    clearActionsEventListeners(this);
    existingInstances.splice( existingInstances.indexOf(this), 1 );
};

// close all instances of context menus
BootstrapMenu.closeAll = function() {
    _.each(existingInstances, function(contextMenu) {
        contextMenu.close();
    });
};

module.exports = BootstrapMenu;
