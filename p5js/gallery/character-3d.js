/**
 * The head in the masthead, in three dimensions, taking over from the drawing.
 *
 * The drawing is the page's first paint and stays the fallback: nothing here is fetched
 * until the page has finished loading, and if any step fails — no WebGL, a blocked module,
 * a missing model — the picture is simply left where it is. It is never removed from the
 * document, only faded behind the canvas.
 *
 * The pointer is still measured in exactly one place. `character.js` writes `--look-x` and
 * `--look-y` on the same element; this reads them and turns the head. Replacing either side
 * means honouring those two numbers and nothing else.
 */
const MODEL_URL = "assets/character/head.glb";

/**
 * How far the head turns at the pointer's full extent. Thirty-four degrees is the
 * three-quarter view: past that the back of the head comes round, and the back of the head
 * is the part a photograph cannot tell a model about — it is invented, and it looks it.
 */
const YAW = 0.6;
/** A nod is a hint rather than a movement. Much more and the face leaves the frame. */
const PITCH = 0.16;
/** Share of the remaining angle covered each frame: a spring with no overshoot. */
const DAMPING = 0.12;

/**
 * Where the head sits in its box, chosen to match the drawing it replaces: the same share
 * of the width, and the crown the same distance below the top. The two stand-ins then swap
 * without the masthead shifting.
 */
const WIDTH_SHARE = 0.42;
const CROWN_SHARE = 0.08;
/** The turn is about the neck, this far up the model, not about its middle. */
const NECK_SHARE = 0.35;

const FIELD_OF_VIEW = 30;

/** Read from the inline declaration the sibling script writes: no layout, no parsing. */
function look(root, name) {
  const value = root.style.getPropertyValue(name);
  return value === "" ? 0 : Number.parseFloat(value);
}

async function start(root) {
  const [three, { GLTFLoader }] = await Promise.all([
    import("three"),
    import("three/addons/loaders/GLTFLoader.js")
  ]);
  const {
    ACESFilmicToneMapping, Box3, DirectionalLight, Group, HemisphereLight,
    MathUtils, PerspectiveCamera, Scene, Vector3, WebGLRenderer
  } = three;

  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const model = gltf.scene;
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());

  // Turning the model about its own origin would swing the head sideways, because that
  // origin is down at the cut. Hang it off a group at the neck instead and turn that.
  const neck = new Vector3(0, box.min.y + size.y * NECK_SHARE, 0);
  const pivot = new Group();
  pivot.position.copy(neck);
  model.position.sub(neck);
  pivot.add(model);

  const scene = new Scene();
  scene.add(pivot);
  scene.add(new HemisphereLight(0xffffff, 0x3a3f52, 2.0));
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(1.4, 2.2, 3);
  scene.add(key);

  // Two lights from behind, one to each side. The hair is black and the page is nearly
  // black, and a front light does nothing for that: it lights what already reads. These
  // catch the edge where the surface turns away, which is the line that says head rather
  // than hole. They are cool rather than white so the rim reads as light rather than as
  // grey hair.
  for (const [x, strength] of [[-1, 2.6], [1, 2.0]]) {
    const rim = new DirectionalLight(0xdae3f7, strength);
    rim.position.set(x * 2.6, 2.8, -2.2);
    scene.add(rim);
  }

  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 100);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  // Two is enough at this size; past it the cost climbs and nothing is gained.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;

  const canvas = renderer.domElement;
  canvas.className = "character__model";
  root.append(canvas);

  /**
   * Frames the model rather than positioning the camera by hand, so the same numbers hold
   * at any width: the model is pulled back until it fills its share of the frame, then the
   * camera is raised until the crown sits where the drawing's did.
   */
  function frame() {
    const bounds = root.getBoundingClientRect();
    if (bounds.width === 0) {
      return false;
    }
    renderer.setSize(bounds.width, bounds.height, false);

    const aspect = bounds.width / bounds.height;
    const spread = 2 * Math.tan(MathUtils.degToRad(FIELD_OF_VIEW) / 2);
    const distance = size.x / WIDTH_SHARE / (spread * aspect);
    const visibleHeight = spread * distance;

    camera.aspect = aspect;
    camera.position.set(0, box.max.y - visibleHeight * (0.5 - CROWN_SHARE), distance);
    camera.lookAt(camera.position.x, camera.position.y, 0);
    camera.updateProjectionMatrix();
    return true;
  }

  let running = false;
  let yaw = 0;
  let pitch = 0;

  function draw() {
    if (!running) {
      return;
    }
    yaw += (look(root, "--look-x") * YAW - yaw) * DAMPING;
    pitch += (look(root, "--look-y") * PITCH - pitch) * DAMPING;
    pivot.rotation.set(pitch, yaw, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(draw);
  }

  function run(should) {
    if (should === running) {
      return;
    }
    running = should;
    if (should) {
      requestAnimationFrame(draw);
    }
  }

  if (!frame()) {
    throw new Error("The figure has no box to draw in.");
  }
  window.addEventListener("resize", () => {
    if (frame() && !running) {
      renderer.render(scene, camera);
    }
  }, { passive: true });

  // Nothing is drawn while the masthead is off screen or the tab is in the background: a
  // decoration has no business keeping a machine awake.
  new IntersectionObserver(([entry]) => {
    run(entry.isIntersecting && !document.hidden);
  }).observe(root);
  document.addEventListener("visibilitychange", () => {
    run(!document.hidden && root.getBoundingClientRect().bottom > 0);
  });

  renderer.render(scene, camera);
  root.classList.add("character--model");
}

const root = document.querySelector("[data-character]");

// The same gate the drawing uses, split the same way. Motion is the one that stops
// everything. A fine pointer is not asked for: it gates following a pointer, not having a
// head, and the sibling script turns this one whether or not there is a pointer to turn it
// towards — so a touch screen, which used to get a photograph that never moved, gets the
// head that wanders.
//
// Save-Data is the exception. Between the model and the renderer this is some two and a half
// megabytes, and a decoration is not what a reader on a metered connection asked to spend it
// on. They keep the drawing, which is already on the page and already turns.
const wanted = root
  && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  && !navigator.connection?.saveData;

if (wanted) {
  const begin = () => {
    start(root).catch(() => {
      // The drawing is still there and still turns. That is the whole of the fallback.
      root.classList.remove("character--model");
    });
  };
  if (document.readyState === "complete") {
    begin();
  } else {
    window.addEventListener("load", begin, { once: true });
  }
}
