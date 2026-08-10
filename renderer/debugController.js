(function () {
  class DebugController {
    constructor(catController) {
      this.cat = catController;
      this.enabled = Boolean(window.CatDebug && window.CatDebug.DEBUG_MODE);

      if (!this.enabled) {
        return;
      }

      window.addEventListener('keydown', (event) => this.handleKeyDown(event));
      window.CatDebug.log('[Debug] Mode enabled');
    }

    handleKeyDown(event) {
      if (!this.enabled) {
        return;
      }

      if (this.handleFocusKey(event)) {
        event.preventDefault();
        return;
      }

      if (event.key === 'F12') {
        window.desktopPet.toggleDevTools();
        event.preventDefault();
        return;
      }

      if (this.handleBoundsKey(event)) {
        event.preventDefault();
        return;
      }

      if (this.handleCornerKey(event)) {
        event.preventDefault();
        return;
      }

      if (this.handleActionKey(event)) {
        event.preventDefault();
      }
    }

    handleActionKey(event) {
      const actionByKey = {
        1: 'IDLE',
        2: 'WALK',
        3: 'REST',
        4: 'ANGRY_1',
        5: 'ANGRY_2',
        6: 'RUN_AWAY',
        7: 'HAPPY',
        8: 'HUNT',
        9: 'DANCE'
      };
      const action = actionByKey[event.key];

      if (!action || event.ctrlKey || event.shiftKey || event.altKey) {
        return false;
      }

      this.cat.forceAction(action);
      return true;
    }

    handleFocusKey(event) {
      const focusByKey = {
        F1: 0,
        F2: 30,
        F3: 60,
        F4: 90
      };

      if (!(event.key in focusByKey)) {
        return false;
      }

      window.CatDebug.setDebugFocus(focusByKey[event.key]);
      return true;
    }

    handleBoundsKey(event) {
      if (!event.shiftKey || event.ctrlKey || event.altKey) {
        return false;
      }

      const edgeByKey = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'top',
        ArrowDown: 'bottom'
      };
      const edge = edgeByKey[event.key];

      if (!edge) {
        return false;
      }

      this.cat.forceMoveToEdge(edge);
      return true;
    }

    handleCornerKey(event) {
      if (!event.ctrlKey || event.shiftKey || event.altKey) {
        return false;
      }

      const cornerByKey = {
        1: 'topLeft',
        2: 'topRight',
        3: 'bottomLeft',
        4: 'bottomRight'
      };
      const corner = cornerByKey[event.key];

      if (!corner) {
        return false;
      }

      this.cat.forceMoveToCorner(corner);
      return true;
    }
  }

  window.DebugController = DebugController;
  window.installDebugController = function installDebugController(catController) {
    if (!window.CatDebug || !window.CatDebug.DEBUG_MODE || window.DebugControllerInstance) {
      return;
    }

    window.DebugControllerInstance = new DebugController(catController);
  };

  if (window.CatControllerInstance) {
    window.installDebugController(window.CatControllerInstance);
  }
})();
