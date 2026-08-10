(function () {
  const EDGE_DESTINATION_CHANCE = 0;
  const INNER_MARGIN_X = 32;
  const INNER_MARGIN_Y = 24;
  const MAX_WANDER_X = 70;
  const MAX_WANDER_Y = 35;
  const CENTER_ZONE = {
    minXRatio: 0.25,
    maxXRatio: 0.75,
    minYRatio: 0.2,
    maxYRatio: 0.8
  };
  const BLOCK_DOWNWARD_MOVEMENT = true;
  const POUNCE_CURSOR_X_OFFSET = -10;
  const POUNCE_CURSOR_Y_OFFSET_RATIO = 1;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  class MovementController {
    constructor(config) {
      this.bounds = config.bounds;
      this.safeBounds = config.safeBounds;
      this.innerBounds = this.createInnerBounds(config.safeBounds);
      this.size = config.size;
      this.position = this.clampPosition(config.position);
      this.target = { ...this.position };
      this.speed = this.pickSpeed();
      this.runSpeed = this.pickRunSpeed();
      this.pounce = null;
    }

    pickSpeed() {
      return randomBetween(25, 45);
    }

    pickRunSpeed() {
      return randomBetween(80, 120);
    }

    pickRandomDestination() {
      this.speed = this.pickSpeed();

      return this.pickNearbyDestination();
    }

    pickNearbyDestination() {
      const destination = this.clampPosition({
        x: this.position.x + randomBetween(-MAX_WANDER_X, MAX_WANDER_X),
        y: this.position.y + randomBetween(-MAX_WANDER_Y, 0)
      });

      this.logDestination('NEARBY', destination);
      return destination;
    }

    pickEdgeDestination() {
      this.speed = randomBetween(25, 45);

      const destination = this.pickNearbyDestination();
      this.logDestination('NEARBY', destination);
      return destination;
    }

    pickRunAwayDestination(cursorPosition) {
      this.runSpeed = this.pickRunSpeed();

      const catCenter = this.getCenter();
      const awayX = catCenter.x >= cursorPosition.x ? 1 : -1;
      const awayY = -1;
      const travelX = randomBetween(80, 140) * awayX;
      const travelY = randomBetween(30, 70) * awayY;
      const destination = this.clampPosition({
        x: this.position.x + travelX,
        y: this.position.y + travelY
      });

      if (Math.hypot(destination.x - this.position.x, destination.y - this.position.y) > this.size.width) {
        return destination;
      }

      return this.pickNearbyDestination();
    }

    getCenter() {
      return {
        x: this.position.x + this.size.width / 2,
        y: this.position.y + this.size.height / 2
      };
    }

    setTarget(target) {
      this.target = this.preventDownwardTarget(this.clampPosition(target));
    }

    setPosition(position) {
      this.position = this.clampPosition(position);
      this.target = { ...this.position };

      return this.position;
    }

    getEdgePosition(edge) {
      const safe = this.safeBounds;
      const current = this.clampPosition(this.position);

      if (edge === 'left') {
        return this.clampPosition({ x: this.innerBounds.minX, y: current.y });
      }

      if (edge === 'right') {
        return this.clampPosition({ x: this.innerBounds.maxX, y: current.y });
      }

      if (edge === 'top') {
        return this.clampPosition({ x: current.x, y: safe.minY });
      }

      return this.clampPosition({ x: current.x, y: current.y });
    }

    getCornerPosition(corner) {
      const safe = this.safeBounds;

      if (corner === 'topLeft') {
        return { x: this.innerBounds.minX, y: this.innerBounds.minY };
      }

      if (corner === 'topRight') {
        return { x: this.innerBounds.maxX, y: this.innerBounds.minY };
      }

      if (corner === 'bottomLeft') {
        return { x: this.innerBounds.minX, y: this.innerBounds.maxY };
      }

      return { x: this.innerBounds.maxX, y: this.innerBounds.maxY };
    }

    setPounceTarget(cursorPosition, now) {
      const pounceY = cursorPosition.y - this.size.height * POUNCE_CURSOR_Y_OFFSET_RATIO;
      const target = this.clampPosition({
        x: cursorPosition.x - this.size.width / 2 + POUNCE_CURSOR_X_OFFSET,
        y: pounceY
      }, this.safeBounds);

      this.pounce = {
        start: { ...this.position },
        target,
        startedAt: now,
        duration: randomBetween(300, 600),
        arcHeight: randomBetween(34, 70)
      };

      this.setTarget(target);
    }

    update(deltaSeconds) {
      return this.move(deltaSeconds, this.speed);
    }

    updateRun(deltaSeconds) {
      return this.move(deltaSeconds, this.runSpeed);
    }

    updatePounce(now) {
      if (!this.pounce) {
        return { position: this.position, arrived: true };
      }

      const progress = clamp((now - this.pounce.startedAt) / this.pounce.duration, 0, 1);
      const eased = easeInOut(progress);
      const arc = Math.sin(Math.PI * progress) * this.pounce.arcHeight;

      this.position = this.clampPosition({
        x: this.pounce.start.x + (this.pounce.target.x - this.pounce.start.x) * eased,
        y: this.pounce.start.y + (this.pounce.target.y - this.pounce.start.y) * eased - arc
      }, this.safeBounds);

      if (progress >= 1) {
        this.position = this.clampPosition(this.pounce.target, this.safeBounds);
        this.pounce = null;
        return { position: this.position, arrived: true };
      }

      return { position: this.position, arrived: false };
    }

    move(deltaSeconds, speed) {
      const dx = this.target.x - this.position.x;
      const dy = this.target.y - this.position.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 1) {
        this.position = this.clampPosition(this.target);
        return { position: this.position, arrived: true };
      }

      const step = Math.min(distance, speed * deltaSeconds);
      this.position = this.clampPosition({
        x: this.position.x + (dx / distance) * step,
        y: this.position.y + (dy / distance) * step
      });
      this.position = this.preventDownwardPosition(this.position);

      return { position: this.position, arrived: step >= distance };
    }

    getDirection() {
      return this.target.x >= this.position.x ? 'right' : 'left';
    }

    isEdgePosition(position) {
      const margin = 24;
      const safe = this.safeBounds;

      return (
        Math.abs(position.x - safe.minX) <= margin ||
        Math.abs(position.x - safe.maxX) <= margin ||
        Math.abs(position.y - safe.minY) <= margin ||
        Math.abs(position.y - safe.maxY) <= margin
      );
    }

    isCenterZone(position) {
      const safe = this.safeBounds;
      const width = safe.maxX - safe.minX;
      const height = safe.maxY - safe.minY;

      return (
        position.x >= safe.minX + width * CENTER_ZONE.minXRatio &&
        position.x <= safe.minX + width * CENTER_ZONE.maxXRatio &&
        position.y >= safe.minY + height * CENTER_ZONE.minYRatio &&
        position.y <= safe.minY + height * CENTER_ZONE.maxYRatio
      );
    }

    clampPosition(position, bounds) {
      const safe = bounds || this.innerBounds || this.safeBounds;

      return {
        x: clamp(position.x, safe.minX, safe.maxX),
        y: clamp(position.y, safe.minY, safe.maxY)
      };
    }

    createInnerBounds(safeBounds) {
      const minX = Math.min(safeBounds.maxX, safeBounds.minX + INNER_MARGIN_X);
      const maxX = Math.max(minX, safeBounds.maxX - INNER_MARGIN_X);
      const minY = Math.min(safeBounds.maxY, safeBounds.minY + INNER_MARGIN_Y);
      const maxY = Math.max(minY, safeBounds.maxY - INNER_MARGIN_Y);

      return { minX, maxX, minY, maxY };
    }

    preventDownwardTarget(position) {
      if (!BLOCK_DOWNWARD_MOVEMENT) {
        return position;
      }

      return {
        x: position.x,
        y: Math.min(position.y, this.position.y)
      };
    }

    preventDownwardPosition(position) {
      if (!BLOCK_DOWNWARD_MOVEMENT) {
        return position;
      }

      return this.clampPosition({
        x: position.x,
        y: Math.min(position.y, this.position.y)
      });
    }

    getNoDownMaxY(maxCandidate) {
      return Math.max(this.safeBounds.minY, Math.min(maxCandidate, this.position.y));
    }

    logDestination(kind, destination) {
      if (window.CatDebug && window.CatDebug.DEBUG_MODE) {
        console.log(`[Cat] Destination: ${kind}`, {
          x: Math.round(destination.x),
          y: Math.round(destination.y)
        });
      }
    }
  }

  window.MovementController = MovementController;
})();
