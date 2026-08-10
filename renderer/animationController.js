(function () {
  class AnimationController {
    constructor(catElement, sprites) {
      this.catElement = catElement;
      this.sprites = sprites;
      this.walkFrames = [sprites.walkLeft01, sprites.walkLeft02];
      this.happyFrames = [sprites.happy01, sprites.happy02];
      this.danceFrames = [
        sprites.dance01,
        sprites.dance02,
        sprites.dance01,
        sprites.dance03,
        sprites.dance02,
        sprites.dance01
      ];
      this.walkFrameIndex = 0;
      this.happyFrameIndex = 0;
      this.danceFrameIndex = 0;
      this.lastFrameAt = 0;
      this.lastHappyFrameAt = 0;
      this.lastDanceFrameAt = 0;
      this.currentSprite = '';
      this.walkFrameMs = 190;
      this.happyFrameMs = 780;
      this.danceFrameMs = 260;
    }

    applyCatSize(size) {
      this.catElement.style.setProperty('--cat-size', `${size}px`);
    }

    setIdle(direction) {
      this.setSprite(this.sprites.basic);
      this.setDirection(direction);
      this.lastFrameAt = 0;
      this.walkFrameIndex = 0;
    }

    setRest(direction) {
      this.setIdle(direction);
    }

    setAngry(level, direction) {
      this.setSprite(level === 2 ? this.sprites.angry02 : this.sprites.angry01);
      this.setDirection(direction);
      this.lastFrameAt = 0;
      this.walkFrameIndex = 0;
    }

    setRunAway(direction) {
      this.setSprite(this.sprites.angryRun);
      this.setDirection(direction);
      this.lastFrameAt = 0;
      this.walkFrameIndex = 0;
    }

    setHuntWatch(direction) {
      this.setSprite(this.sprites.huntWatch);
      this.setDirection(direction);
    }

    setHuntReady(direction) {
      this.setSprite(this.sprites.huntReady);
      this.setDirection(direction);
    }

    setHuntWiggle(now, direction) {
      const offsets = [-3, 3, -2, 2];
      const offset = offsets[Math.floor(now / 80) % offsets.length];

      this.setSprite(this.sprites.huntWiggle);
      this.setDirection(direction, offset);
    }

    setHuntPounce(direction) {
      this.setSprite(this.sprites.huntPounce);
      this.setDirection(direction);
    }

    startHappy(now) {
      this.happyFrameIndex = 0;
      this.lastHappyFrameAt = now;
      this.setSprite(this.happyFrames[0]);
    }

    updateHappy(now, direction) {
      if (now - this.lastHappyFrameAt >= this.happyFrameMs) {
        this.happyFrameIndex = (this.happyFrameIndex + 1) % this.happyFrames.length;
        this.setSprite(this.happyFrames[this.happyFrameIndex]);
        this.lastHappyFrameAt = now;
      }

      const breathingOffset = Math.sin(now / 900) * -1.5;
      this.setDirection(direction, 0, breathingOffset);
    }

    startDance(now) {
      this.danceFrameIndex = 0;
      this.lastDanceFrameAt = now;
      this.setSprite(this.danceFrames[0]);
    }

    updateDance(now, direction) {
      if (now - this.lastDanceFrameAt >= this.getDanceFrameMs()) {
        this.danceFrameIndex = (this.danceFrameIndex + 1) % this.danceFrames.length;
        this.setSprite(this.danceFrames[this.danceFrameIndex]);
        this.lastDanceFrameAt = now;
      }

      this.setDirection(direction);
    }

    getDanceFrameMs() {
      if (!window.CatDebug || !window.CatDebug.DEBUG_MODE) {
        return this.danceFrameMs;
      }

      return this.danceFrameMs * (window.CatDebug.DEBUG_DANCE_TIME_SCALE || 1);
    }

    updateWalk(now, direction) {
      this.setDirection(direction);

      if (!this.catElement.src || now - this.lastFrameAt >= this.walkFrameMs) {
        this.setSprite(this.walkFrames[this.walkFrameIndex]);
        this.walkFrameIndex = (this.walkFrameIndex + 1) % this.walkFrames.length;
        this.lastFrameAt = now;
      }
    }

    setSprite(src) {
      if (this.currentSprite === src) {
        return;
      }

      this.catElement.src = src;
      this.currentSprite = src;
    }

    setDirection(direction, offsetX = 0, offsetY = 0) {
      const facing = direction === 'right' ? -1 : 1;
      this.catElement.style.transform = `translateX(calc(-50% + ${offsetX}px)) translateY(${offsetY}px) scaleX(${facing})`;
    }
  }

  window.AnimationController = AnimationController;
})();
