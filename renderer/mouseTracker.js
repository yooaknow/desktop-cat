(function () {
  const CURSOR_DETECTION_RADIUS = 220;
  const APPROACH_RESET_MS = 8000;

  class MouseTracker {
    constructor(movement) {
      this.movement = movement;
      this.cursorPosition = null;
      this.cursorInside = false;
      this.cursorApproachCount = 0;
      this.lastApproachAt = 0;
      this.lastDistance = Infinity;
    }

    async update(now, options = {}) {
      const countApproach = options.countApproach !== false;
      this.cursorPosition = await window.desktopPet.getCursorPosition();
      const center = this.movement.getCenter();
      const distance = Math.hypot(
        this.cursorPosition.x - center.x,
        this.cursorPosition.y - center.y
      );
      const inside = distance <= CURSOR_DETECTION_RADIUS;

      if (countApproach && inside && !this.cursorInside) {
        if (now - this.lastApproachAt > APPROACH_RESET_MS) {
          this.cursorApproachCount = 0;
        }

        this.cursorApproachCount += 1;
        this.lastApproachAt = now;
      }

      if (countApproach) {
        this.cursorInside = inside;
      }
      this.lastDistance = distance;

      return {
        cursorPosition: this.cursorPosition,
        inside,
        approachCount: this.cursorApproachCount,
        distance
      };
    }

    resetApproaches() {
      this.cursorApproachCount = 0;
      this.cursorInside = false;
      this.lastApproachAt = 0;
    }

    getCursorPosition() {
      return this.cursorPosition;
    }
  }

  window.MouseTracker = MouseTracker;
  window.CursorSettings = { CURSOR_DETECTION_RADIUS };
})();
