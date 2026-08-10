(function () {
  const spriteBasePath = '../optimized-assets/';

  window.PetSprites = {
    basic: `${spriteBasePath}basic_posture.png`,
    walkLeft01: `${spriteBasePath}left_walk_01.png`,
    walkLeft02: `${spriteBasePath}left_walk_02.png`,
    angry01: `${spriteBasePath}angry_01.png`,
    angry02: `${spriteBasePath}angry_02.png`,
    angryRun: `${spriteBasePath}angry_03_run.png`,
    huntWatch: `${spriteBasePath}hunt_01_cursor_watch.png`,
    huntReady: `${spriteBasePath}hunt_02__ready.png`,
    huntWiggle: `${spriteBasePath}hunt_03__butt_wiggle.png`,
    huntPounce: `${spriteBasePath}hunt_04__pounce.png`,
    happy01: `${spriteBasePath}happy_01.png`,
    happy02: `${spriteBasePath}happy_02.png`,
    dance01: `${spriteBasePath}dance_01.png`,
    dance02: `${spriteBasePath}dance_02.png`,
    dance03: `${spriteBasePath}dance_03.png`
  };

  Object.values(window.PetSprites).forEach((src) => {
    const image = new Image();
    image.src = src;
  });
})();
