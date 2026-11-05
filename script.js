// ==========================================
// 0. ACETERNITY UI CANVAS REVEAL EFFECT (SUBTLE PULSING SQUARES)
// ==========================================
function initCanvasRevealEffect() {
  const canvas = document.getElementById("reveal-canvas");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
  if (!gl) {
    initCanvas2DFallback(canvas);
    return;
  }

  const vsSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment shader derived directly from Aceternity UI CanvasRevealEffect
  const fsSource = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_total_size;
    uniform float u_dot_size;
    uniform vec3 u_color;
    uniform float u_is_dark;

    float PHI = 1.61803398874989484820459;
    float random(vec2 xy) {
      return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
    }

    void main() {
      vec2 st = gl_FragCoord.xy;
      st.y = u_resolution.y - st.y;

      vec2 st2 = floor(st / u_total_size);

      // Slow pulsation frequency (small blocks turning off and on slowly)
      float frequency = 4.8;
      float show_offset = random(st2);
      
      float phase = (u_time / frequency) + show_offset * 12.0;
      float t0 = floor(phase);
      float progress = fract(phase);

      float randA = random(st2 * (t0 + 1.0) + 0.123);
      float randB = random(st2 * (t0 + 2.0) + 0.123);

      // Smoothstep easing between on/off states
      float s = smoothstep(0.0, 1.0, progress);

      // Subtle metallic slate square blocks matching screenshot
      float maxOp = u_is_dark > 0.5 ? 0.18 : 0.10;
      float opA = randA < 0.35 ? 0.0 : ((randA - 0.35) / 0.65) * maxOp;
      float opB = randB < 0.35 ? 0.0 : ((randB - 0.35) / 0.65) * maxOp;

      float opacity = mix(opA, opB, s);

      // Small rounded square block mask (SDF smoothstep)
      vec2 cell = mod(st, u_total_size);
      vec2 d = abs(cell - vec2(u_total_size * 0.5)) - vec2(u_dot_size * 0.5);
      float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
      float shape = 1.0 - smoothstep(-0.5, 0.5, dist);

      opacity *= shape;

      gl_FragColor = vec4(u_color * opacity, opacity);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) {
    initCanvas2DFallback(canvas);
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    initCanvas2DFallback(canvas);
    return;
  }

  gl.useProgram(program);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const aPosition = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uTimeLoc = gl.getUniformLocation(program, "u_time");
  const uResLoc = gl.getUniformLocation(program, "u_resolution");
  const uTotalSizeLoc = gl.getUniformLocation(program, "u_total_size");
  const uDotSizeLoc = gl.getUniformLocation(program, "u_dot_size");
  const uColorLoc = gl.getUniformLocation(program, "u_color");
  const uIsDarkLoc = gl.getUniformLocation(program, "u_is_dark");

  const startTime = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener("resize", resize);
  resize();

  function render(now) {
    const elapsed = (now - startTime) / 1000.0;
    const isDark = document.documentElement.classList.contains("dark");

    gl.useProgram(program);

    gl.uniform1f(uTimeLoc, elapsed);
    gl.uniform2f(uResLoc, canvas.width, canvas.height);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gl.uniform1f(uTotalSizeLoc, 16.0 * dpr);
    gl.uniform1f(uDotSizeLoc, 2.8 * dpr);

    if (isDark) {
      gl.uniform3f(uColorLoc, 0.82, 0.85, 0.90);
      gl.uniform1f(uIsDarkLoc, 1.0);
    } else {
      gl.uniform3f(uColorLoc, 0.12, 0.12, 0.14);
      gl.uniform1f(uIsDarkLoc, 0.0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function initCanvas2DFallback(canvas) {
  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const cellSize = 16;
  const dotSize = 2.8;

  function render(time) {
    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.classList.contains("dark");
    const t = time * 0.0006;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const offset = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
        const seed = offset - Math.floor(offset);
        const pulse = Math.sin(t * 1.4 + seed * 10.0);
        if (pulse > 0.3) {
          const alpha = (pulse - 0.3) * (isDark ? 0.18 : 0.10);
          ctx.fillStyle = isDark
            ? `rgba(210, 220, 230, ${alpha})`
            : `rgba(25, 25, 30, ${alpha})`;
          ctx.fillRect(i * cellSize, j * cellSize, dotSize, dotSize);
        }
      }
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

// ==========================================
// 1. EXACT JAYJR CANVAS CURSOR WAVE FOLLOWER
// ==========================================
function initCanvasCursor() {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let running = true;
  let frame = 1;

  function hexToRgb(str) {
    if (!str) return { r: 237, g: 237, b: 237 };
    str = str.trim();
    if (str.startsWith("#")) {
      let t = str.slice(1);
      if (t.length === 3) t = t.split("").map(c => c + c).join("");
      let r = parseInt(t, 16);
      return { r: (r >> 16) & 255, g: (r >> 8) & 255, b: 255 & r };
    }
    if (str.startsWith("rgb")) {
      const match = str.match(/\d+/g);
      if (match && match.length >= 3) {
        return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
      }
    }
    return { r: 128, g: 128, b: 128 };
  }

  let color = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue("--fg") || "#ededed");

  function updateColor() {
    color = hexToRgb(getComputedStyle(document.documentElement).getPropertyValue("--fg") || "#ededed");
  }

  new MutationObserver(updateColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let trails = [];
  const config = {
    friction: 0.5,
    trails: 5,
    size: 18,
    dampening: 0.25,
    tension: 0.98
  };

  function Node() {
    this.x = pos.x;
    this.y = pos.y;
    this.vy = 0;
    this.vx = 0;
  }

  function Trail(opt) {
    this.spring = opt.spring + 0.1 * Math.random() - 0.02;
    this.friction = config.friction + 0.01 * Math.random() - 0.002;
    this.nodes = [];
    for (let i = 0; i < config.size; i++) {
      const node = new Node();
      node.x = pos.x;
      node.y = pos.y;
      this.nodes.push(node);
    }
  }

  Trail.prototype.update = function () {
    let spring = this.spring;
    let node = this.nodes[0];
    node.vx += (pos.x - node.x) * spring;
    node.vy += (pos.y - node.y) * spring;
    for (let i = 0; i < this.nodes.length; i++) {
      node = this.nodes[i];
      if (i > 0) {
        const prev = this.nodes[i - 1];
        node.vx += (prev.x - node.x) * spring;
        node.vy += (prev.y - node.y) * spring;
        node.vx += prev.vx * config.dampening;
        node.vy += prev.vy * config.dampening;
      }
      node.vx *= this.friction;
      node.vy *= this.friction;
      node.x += node.vx;
      node.y += node.vy;
      spring *= config.tension;
    }
  };

  Trail.prototype.draw = function () {
    let e, t, r = this.nodes[0].x, n = this.nodes[0].y;
    ctx.beginPath();
    ctx.moveTo(r, n);
    for (let o = 1, a = this.nodes.length - 2; o < a; o++) {
      e = this.nodes[o];
      t = this.nodes[o + 1];
      r = 0.5 * (e.x + t.x);
      n = 0.5 * (e.y + t.y);
      ctx.quadraticCurveTo(e.x, e.y, r, n);
    }
    e = this.nodes[this.nodes.length - 2];
    t = this.nodes[this.nodes.length - 1];
    ctx.quadraticCurveTo(e.x, e.y, t.x, t.y);
    ctx.stroke();
    ctx.closePath();
  };

  function onPointerMove(e) {
    function updatePos(ev) {
      if (ev.touches && ev.touches.length > 0) {
        pos.x = ev.touches[0].pageX;
        pos.y = ev.touches[0].pageY;
      } else {
        pos.x = ev.clientX;
        pos.y = ev.clientY;
      }
    }
    document.removeEventListener("mousemove", onPointerMove);
    document.removeEventListener("touchstart", onPointerMove);
    document.addEventListener("mousemove", updatePos);
    document.addEventListener("touchmove", updatePos, { passive: true });
    updatePos(e);
    trails = [];
    for (let i = 0; i < config.trails; i++) {
      trails.push(new Trail({ spring: 0.4 + (i / config.trails) * 0.025 }));
    }
    render();
  }

  function render() {
    if (running) {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.25)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < config.trails; i++) {
        trails[i].update();
        trails[i].draw();
      }
      frame++;
      window.requestAnimationFrame(render);
    }
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("focus", () => {
    if (!running) {
      running = true;
      render();
    }
  });

  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("touchstart", onPointerMove, { passive: true });
  resize();

  // Creative Luminous Click Shockwaves
  const ripples = [];
  document.addEventListener("click", (e) => {
    ripples.push({
      x: e.clientX,
      y: e.clientY,
      r: 4,
      maxR: 90 + Math.random() * 30,
      alpha: 0.5
    });
  });

  // Patch render to also draw expanding luminous ripples
  const originalRender = render;
  render = function () {
    if (running) {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw trails
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.25)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < config.trails; i++) {
        trails[i].update();
        trails[i].draw();
      }

      // Draw creative expanding ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += (rip.maxR - rip.r) * 0.08 + 1.2;
        rip.alpha -= 0.012;

        if (rip.alpha <= 0 || rip.r >= rip.maxR) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${rip.alpha * 0.35})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (rip.r > 20) {
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r * 0.65, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${rip.alpha * 0.15})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      frame++;
      window.requestAnimationFrame(render);
    }
  };
}

// ==========================================
// 2. THEME TOGGLE (DARK / LIGHT)
// ==========================================
function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  const toggleLabel = document.getElementById("theme-toggle-label");
  const html = document.documentElement;

  const savedTheme = localStorage.getItem("portfolio_theme") || "dark";
  applyTheme(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isDark = html.classList.contains("dark");
      const nextTheme = isDark ? "light" : "dark";
      applyTheme(nextTheme);
    });
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      html.classList.add("dark");
      html.classList.remove("light");
      if (toggleLabel) toggleLabel.textContent = "Light";
      else if (toggleBtn) toggleBtn.textContent = "Light";
    } else {
      html.classList.remove("dark");
      html.classList.add("light");
      if (toggleLabel) toggleLabel.textContent = "Dark";
      else if (toggleBtn) toggleBtn.textContent = "Dark";
    }
    localStorage.setItem("portfolio_theme", theme);
  }
}

// ==========================================
// 3. AVATAR 3D FLIP & ILLUSTRATION SPARKLES
// ==========================================
function initAvatarFlip() {
  const btn = document.getElementById("avatar-btn");
  const card = document.getElementById("avatar-card");
  const container = document.querySelector(".avatar-container");
  if (!btn || !card) return;

  btn.addEventListener("click", () => {
    const isFlipped = card.classList.toggle("flipped");
    btn.setAttribute("aria-pressed", isFlipped ? "true" : "false");

    // When flipping to Imtiyaz's thumbs-up illustrated avatar, burst out anime sparkle stars ✨!
    if (isFlipped && container) {
      spawnAvatarSparkles(container);
    }
  });
}

function spawnAvatarSparkles(parent) {
  const starColors = ["#fbbf24", "#f59e0b", "#ffffff", "#38bdf8", "#fcd34d"];
  const numStars = 14;

  for (let i = 0; i < numStars; i++) {
    const star = document.createElement("div");
    star.className = "avatar-sparkle";

    const angle = (i / numStars) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = 50 + Math.random() * 55;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    const rot = (Math.random() * 360) + "deg";
    const dur = (0.75 + Math.random() * 0.3) + "s";
    const size = 11 + Math.random() * 12;
    const color = starColors[Math.floor(Math.random() * starColors.length)];

    star.style.setProperty("--tx", `${tx}px`);
    star.style.setProperty("--ty", `${ty}px`);
    star.style.setProperty("--rot", rot);
    star.style.setProperty("--dur", dur);
    star.style.left = "56px";
    star.style.top = "56px";
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;

    star.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
        <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"/>
      </svg>
    `;

    parent.appendChild(star);
    star.addEventListener("animationend", () => star.remove());
  }
}

// ==========================================
// 4. HOBBIES INTERACTIVE POPOVER
// ==========================================
const hobbiesData = {
  Cricket: {
    title: "Cricket & Physical Fitness",
    items: ["Weekend Cricket", "Running", "Staying Active"],
    note: "Playing weekend cricket and working out keeps me refreshed, energized, and sharp for long coding, data analysis, and debugging sessions."
  },
  Tech: {
    title: "AI Tinkering & Tech Reading",
    items: ["Hugging Face Transformers", "Python 3.12+ Features", "Model Architecture Notes"],
    note: "I love exploring open-source ML models, reading engineering blogs, and tinkering with new Python tools, algorithms, and NLP pipelines."
  },
  Community: {
    title: "Developer Communities & Peer Sharing",
    items: ["Python Community", "Peer Code Reviews", "Debugging Walkthroughs"],
    note: "Engaging with other developers, discussing tricky software bugs, and sharing practical solutions and lessons learned along the way."
  },
  Visuals: {
    title: "Interactive UIs & Data Dashboards",
    items: ["Streamlit Web Apps", "Power BI Dashboards", "Flask REST APIs"],
    note: "Designing intuitive interfaces for machine learning tools so non-technical users can interact with complex models effortlessly."
  },
  // Legacy aliases
  Physical: {
    title: "Cricket & Physical Fitness",
    items: ["Weekend Cricket", "Running", "Staying Active"],
    note: "Playing weekend cricket and working out keeps me refreshed and sharp."
  },
  Intellectual: {
    title: "AI Tinkering & Tech Reading",
    items: ["Hugging Face Transformers", "Python Tools", "Model Architectures"],
    note: "Exploring open-source ML models and tinkering with new Python tools."
  },
  Social: {
    title: "Developer Communities & Peer Sharing",
    items: ["Python Community", "Peer Reviews", "Tech Discussions"],
    note: "Engaging with other developers and discussing practical software solutions."
  },
  Creative: {
    title: "Interactive UIs & Data Dashboards",
    items: ["Streamlit Web Apps", "Power BI Dashboards", "Flask APIs"],
    note: "Designing intuitive interfaces for machine learning tools."
  }
};

function initHobbies() {
  const container = document.getElementById("hobbies-container");
  const popover = document.getElementById("hobby-popover");
  const popoverTitle = document.getElementById("hobby-popover-title");
  const popoverNote = document.getElementById("hobby-popover-note");
  const popoverTags = document.getElementById("hobby-popover-tags");
  const pills = document.querySelectorAll(".hobby-pill");

  let currentActive = null;

  pills.forEach(pill => {
    const key = pill.dataset.hobby;
    const data = hobbiesData[key];
    if (!data) return;

    function show() {
      popoverTitle.textContent = data.title;
      popoverNote.textContent = data.note;
      popoverTags.innerHTML = data.items.map(it => `<span class="hobby-popover-tag">${it}</span>`).join("");
      
      const rect = pill.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      const offsetLeft = rect.left - parentRect.left;
      popover.style.left = `${Math.max(0, Math.min(offsetLeft, parentRect.width - 290))}px`;

      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      popover.classList.add("visible");
      currentActive = key;
    }

    function hide() {
      popover.classList.remove("visible");
      pills.forEach(p => p.classList.remove("active"));
      currentActive = null;
    }

    pill.addEventListener("mouseenter", show);
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentActive === key) {
        hide();
      } else {
        show();
      }
    });
  });

  container.addEventListener("mouseleave", () => {
    popover.classList.remove("visible");
    pills.forEach(p => p.classList.remove("active"));
    currentActive = null;
  });

  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) {
      popover.classList.remove("visible");
      pills.forEach(p => p.classList.remove("active"));
      currentActive = null;
    }
  });
}

// ==========================================
// 5. BLOG MODAL SYSTEM (Technical Deep Dives)
// ==========================================
const blogsData = [
  {
    id: 1,
    title: "Building an End-to-End Sentiment Analysis Pipeline with BERT & Streamlit",
    meta: "NLP & Transformer Architecture | Practical AI Engineering",
    tagline: "From customer review preprocessing to fine-tuned transformer inference and Streamlit deployment.",
    sections: [
      {
        heading: "The Challenge of Customer Sentiment at Scale",
        content: "Organizations receive thousands of customer reviews, product feedback entries, and support messages every single day. Traditional rule-based keyword matchers or basic Bag-of-Words models struggle with linguistic nuance—such as sarcasm, negations, and complex sentence structures.\n\nTo solve this, I designed and implemented an end-to-end NLP text classification pipeline utilizing BERT (Bidirectional Encoder Representations from Transformers) to automatically classify text reviews into positive, neutral, or negative categories with high precision."
      },
      {
        heading: "Tokenization & Preprocessing with Hugging Face",
        bullets: [
          "1. Review Ingestion: Handled diverse customer feedback datasets with variable text lengths and informal phrasing.",
          "2. Tokenization: Used Hugging Face BertTokenizer to segment text into WordPiece subwords, inserting [CLS] and [SEP] boundary tokens.",
          "3. Sequence Normalization: Enforced systematic truncation and padding with dynamic attention masks to preserve contextual semantics while optimizing batch memory.",
          "4. Data Splitting: Stratified splits into training, validation, and test partitions to ensure unbiased evaluation across all three sentiment classes."
        ]
      },
      {
        heading: "Model Fine-Tuning & Scikit-learn Evaluation",
        content: "Fine-tuning pretrained BERT allows the model to leverage its massive contextual understanding while adapting its classification head to specific product review nuances.\n\nUsing Scikit-learn alongside PyTorch and Hugging Face Transformers, I monitored classification loss and evaluated performance using macro-averaged Precision, Recall, and F1-Scores. The resulting model demonstrated robust generalizability across diverse product categories."
      },
      {
        heading: "Classification Metrics & Confidence Tiers",
        table: [
          { color: "Green", meaning: "Positive Sentiment", example: "High customer satisfaction, praise for quality or performance (>90% confidence)" },
          { color: "Yellow", meaning: "Neutral Sentiment", example: "Objective inquiries, mixed feedback, or informational statements" },
          { color: "Red", meaning: "Negative Sentiment", example: "Critical feedback, bug reports, dissatisfaction, or refund requests" }
        ]
      },
      {
        heading: "Interactive Streamlit Deployment",
        content: "A machine learning model is only truly valuable when stakeholders can interact with it effortlessly. I built a responsive Streamlit web application that provides real-time sentiment prediction, displays confidence score breakdowns, and enables batch CSV uploads for instant sentiment analysis reporting."
      }
    ]
  },
  {
    id: 2,
    title: "Housing Price Prediction: From Feature Engineering to Flask REST API",
    meta: "Machine Learning & Production Deployment | Data Solutions",
    tagline: "Exploratory data analysis, regression modeling with Random Forest, and RESTful service deployment.",
    sections: [
      {
        heading: "Why Machine Learning for Real Estate Valuation?",
        content: "Estimating residential real estate values requires synthesizing dozens of competing factors—square footage, neighborhood demographics, bedroom and bathroom counts, property age, and local amenities.\n\nIn this project, I developed predictive regression models using Linear Regression and Random Forest to provide accurate, data-backed housing price estimates."
      },
      {
        heading: "Data Preparation & Exploratory Data Analysis (EDA)",
        bullets: [
          "Data Cleaning: Used Pandas and NumPy to identify missing values, detect price outliers, and normalize skewed distributions.",
          "Feature Engineering: Created derived indicators including price-per-square-foot ratios, total bathroom-to-bedroom metrics, and encoded categorical location features.",
          "Correlation Analysis: Evaluated feature collinearities to prevent multicollinearity and select the most impactful predictive features."
        ]
      },
      {
        heading: "Model Training & Benchmarking",
        content: "I trained and benchmarked multiple regression algorithms:\n\n• Linear Regression established a solid interpretable baseline with an R² score of 0.84.\n• Random Forest Regressor captured non-linear feature interactions and localized pricing thresholds, boosting performance to an R² score of 0.93 with an RMSE reduction of over 45%.\n\nK-fold cross-validation ensured the model did not overfit local neighborhood price anomalies."
      },
      {
        heading: "Deploying as a REST API with Flask",
        content: "To enable seamless integration with client applications and web dashboards, I serialized the trained model and preprocessing pipeline and built a lightweight Flask REST API.\n\nThe API accepts JSON payloads containing property parameters, validates input formats, executes feature transformations, and returns estimated valuations with 95% confidence intervals in under 15 milliseconds."
      }
    ]
  }
];

function initBlogModal() {
  const modal = document.getElementById("blog-modal");
  const modalBody = document.getElementById("blog-modal-body");
  const closeBtn = document.getElementById("blog-modal-close");
  const blogCards = document.querySelectorAll(".blog-card");

  function openBlog(id) {
    const blog = blogsData.find(b => b.id === Number(id));
    if (!blog) return;

    let html = `
      <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
        <span style="font-family: var(--font-mono); font-size: 13px; color: var(--muted);">${blog.meta}</span>
        <h2 style="font-size: 22px; font-weight: 600; color: var(--fg); margin-top: 0.4rem; line-height: 1.3;">${blog.title}</h2>
        ${blog.tagline ? `<p style="font-family: var(--font-mono); font-size: 12.5px; color: var(--muted); margin-top: 0.35rem; font-style: italic;">${blog.tagline}</p>` : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 1.5rem; color: var(--fg);">
    `;

    blog.sections.forEach(sec => {
      html += `<div><h3 style="font-size: 15px; font-weight: 600; color: var(--fg); margin-bottom: 0.4rem;">${sec.heading}</h3>`;
      if (sec.content) {
        const paragraphs = sec.content.split('\n\n');
        paragraphs.forEach(p => {
          html += `<p style="font-size: 14px; color: var(--muted); line-height: 1.65; margin-bottom: 0.5rem; white-space: pre-line;">${p}</p>`;
        });
      }
      if (sec.bullets) {
        html += `<ul style="margin-top: 0.4rem; padding-left: 1.25rem; font-size: 14px; color: var(--muted); line-height: 1.6;">`;
        sec.bullets.forEach(b => {
          html += `<li style="margin-bottom: 0.35rem;">${b}</li>`;
        });
        html += `</ul>`;
      }
      if (sec.table) {
        html += `<div style="overflow-x: auto; margin-top: 0.6rem; border: 1px solid var(--border); border-radius: 6px;"><table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); background: var(--card-hover); color: var(--muted); font-family: var(--font-mono);">
              <th style="padding: 8px 12px;">Severity</th>
              <th style="padding: 8px 12px;">Meaning</th>
              <th style="padding: 8px 12px;">Scenario & Findings</th>
            </tr>
          </thead>
          <tbody>`;
        sec.table.forEach(row => {
          let badgeColor = "#10b981";
          if (row.color === "Yellow") badgeColor = "#eab308";
          if (row.color === "Orange") badgeColor = "#f97316";
          if (row.color === "Red") badgeColor = "#ef4444";
          html += `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 8px 12px;"><span style="color: ${badgeColor}; font-weight: 600; font-family: var(--font-mono);">● ${row.color}</span></td>
            <td style="padding: 8px 12px; color: var(--fg); font-weight: 500;">${row.meaning}</td>
            <td style="padding: 8px 12px; color: var(--muted); font-size: 12.5px;">${row.example}</td>
          </tr>`;
        });
        html += `</tbody></table></div>`;
      }
      html += `</div>`;
    });

    html += `
      <div style="border-top: 1px solid var(--border); padding-top: 1.25rem; margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-mono); font-size: 12px; color: var(--muted);">CIE Guideline Narrative Style</span>
        <button id="modal-read-done-btn" style="background: var(--fg); color: var(--bg); border: none; padding: 0.4rem 1rem; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;">Close Article</button>
      </div>
    </div>`;

    modalBody.innerHTML = html;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    document.getElementById("modal-read-done-btn").addEventListener("click", closeBlog);
  }

  function closeBlog() {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  blogCards.forEach(card => {
    card.addEventListener("click", () => {
      openBlog(card.dataset.blogId);
    });
  });

  closeBtn.addEventListener("click", closeBlog);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeBlog();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBlog();
  });
}

// ==========================================
// 6. RESUME VIEWER MODAL & DIRECT DOCUMENT VIEW
// ==========================================
function initResumeModal() {
  const modal = document.getElementById("resume-modal");
  const closeBtn = document.getElementById("resume-modal-close");
  const triggerBtns = document.querySelectorAll(".resume-trigger");

  function openResume() {
    if (!modal) return;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeResume() {
    if (!modal) return;
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  triggerBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openResume();
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", closeResume);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeResume();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeResume();
  });
}

function initResumeZoom() {
  const img = document.getElementById("resume-page-img");
  const zoomBtn = document.getElementById("resume-zoom-btn");
  const zoomText = document.getElementById("resume-zoom-text");
  const viewport = document.getElementById("resume-scroll-viewport");
  if (!img) return;

  let isZoomed = false;
  let targetOriginX = 50;
  let targetOriginY = 20;
  let currentOriginX = 50;
  let currentOriginY = 20;
  let rafId = null;
  const LERP_FACTOR = 0.08; // Silky-smooth physics dampening (prevents jitter and edge snapping)

  function updateOriginLoop() {
    if (!isZoomed) return;

    // Dampen origin towards target smoothly
    currentOriginX += (targetOriginX - currentOriginX) * LERP_FACTOR;
    currentOriginY += (targetOriginY - currentOriginY) * LERP_FACTOR;

    img.style.transformOrigin = `${currentOriginX.toFixed(2)}% ${currentOriginY.toFixed(2)}%`;

    rafId = requestAnimationFrame(updateOriginLoop);
  }

  function toggleZoom(clientX, clientY) {
    isZoomed = !isZoomed;

    if (isZoomed) {
      img.classList.add("is-zoomed");
      if (zoomBtn) zoomBtn.classList.add("active");
      if (zoomText) zoomText.textContent = "Fit Page";

      // If triggered with click coordinates, set target and current origin directly there
      if (typeof clientX === "number" && typeof clientY === "number") {
        const rect = img.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
          const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
          targetOriginX = xPct;
          targetOriginY = yPct;
          currentOriginX = xPct;
          currentOriginY = yPct;
        }
      }

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateOriginLoop);
    } else {
      resetZoom();
    }
  }

  function resetZoom() {
    isZoomed = false;
    if (rafId) cancelAnimationFrame(rafId);
    img.classList.remove("is-zoomed");
    if (zoomBtn) zoomBtn.classList.remove("active");
    if (zoomText) zoomText.textContent = "Zoom";
    img.style.transformOrigin = "50% 0%";
    currentOriginX = 50;
    currentOriginY = 20;
    targetOriginX = 50;
    targetOriginY = 20;
  }

  window.resetResumeZoom = resetZoom;

  // Clicking directly on the resume page smoothly toggles zoom at click location
  img.addEventListener("click", (e) => {
    toggleZoom(e.clientX, e.clientY);
  });

  // Clicking the Zoom button in the modal header
  if (zoomBtn) {
    zoomBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleZoom();
    });
  }

  // Pointer move smoothly updates target coords without instant transform snapping
  function handlePointerMove(clientX, clientY) {
    if (!isZoomed) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    targetOriginX = xPct;
    targetOriginY = yPct;
  }

  if (viewport) {
    viewport.addEventListener("mousemove", (e) => {
      handlePointerMove(e.clientX, e.clientY);
    });

    viewport.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }
}

// ==========================================
// 7. TOAST NOTIFICATION
// ==========================================
function showToast(msg) {
  const toast = document.getElementById("toast-notice");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// ==========================================
// 8. CLIPBOARD COPY FOR EMAIL / CONTACT
// ==========================================
function initCopyButtons() {
  const copyBtns = document.querySelectorAll("[data-copy], .email-copy-btn, #email-copy-btn, .discord-copy-btn, #discord-copy-btn");
  copyBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = btn.getAttribute("data-copy") || "imtiyazkhan6685@gmail.com";
      navigator.clipboard.writeText(val).then(() => {
        const isPhone = val.includes("+91") || val.startsWith("+");
        showToast(isPhone ? `Phone copied: ${val}` : `Email copied: ${val}`);
      }).catch(() => {
        showToast(`Copied: ${val}`);
      });
    });
  });
}

// ==========================================
// 9. STICKY TOP MENU BAR & SECTION SCROLLSPY
// ==========================================
function initStickyMenuBar() {
  const stickyBar = document.getElementById("sticky-menu-bar");
  if (!stickyBar) return;

  function updateStickyBar() {
    // Menu bar is visible from the very start; adds subtle elevated shadow when scrolled
    if (window.scrollY > 20) {
      stickyBar.classList.add("is-scrolled");
    } else {
      stickyBar.classList.remove("is-scrolled");
    }
  }

  window.addEventListener("scroll", updateStickyBar, { passive: true });
  updateStickyBar();
}

function initNavigation() {
  // Smooth scroll with offset for section links
  const links = document.querySelectorAll(".nav-sec-link, .nav-brand-btn");
  links.forEach(link => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        e.preventDefault();
        if (href === "#hero" || href === "#") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          const target = document.querySelector(href);
          if (target) {
            const topOffset = target.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top: topOffset, behavior: "smooth" });
          }
        }
      }
    });
  });

  // Dynamic ScrollSpy to highlight active section
  const sections = ["experience", "projects", "writing", "certifications"];
  const navLinks = document.querySelectorAll(".nav-sec-link");

  function updateActiveSection() {
    const scrollPosition = window.scrollY + 100;

    let currentSection = "";
    if (window.scrollY > 180) {
      sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            currentSection = id;
          }
        }
      });
    }

    navLinks.forEach(link => {
      if (currentSection && link.dataset.section === currentSection) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  window.addEventListener("scroll", updateActiveSection, { passive: true });
  updateActiveSection();
}

// ==========================================
// 10. TACTILE 3D CARD PERSPECTIVE TILT & SPECULAR GLOW
// ==========================================
function initCard3DTilt() {
  const cards = document.querySelectorAll(".project-preview, .blog-bento-card");

  cards.forEach(card => {
    const sheen = card.querySelector(".specular-sheen");

    function handleMove(e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const px = (x / rect.width) * 100;
      const py = (y / rect.height) * 100;

      const nx = (x / rect.width - 0.5) * 2;
      const ny = (y / rect.height - 0.5) * 2;

      const rotX = -ny * 7;
      const rotY = nx * 7;

      card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;

      if (sheen) {
        sheen.style.background = `radial-gradient(circle 240px at ${px.toFixed(1)}% ${py.toFixed(1)}%, rgba(255, 255, 255, 0.22), transparent 75%)`;
      }
    }

    function handleLeave() {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    }

    card.addEventListener("mousemove", handleMove);
    card.addEventListener("mouseleave", handleLeave);
  });
}

// ==========================================
// 11. MAGNETIC ATTRACTION ON TECH BADGES & PILLS
// ==========================================
function initMagneticElements() {
  // Only enable on desktop mouse pointers to protect mobile touch gestures & clicks
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const magnetics = document.querySelectorAll(".tech-card-cell, .hero-tag, .tech-filter-pill, .project-action-btn, .exp-period-badge, .nav-brand-btn, .resume-trigger, .hobby-pill, .contact-copy-pill");

  magnetics.forEach(el => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate3d(${(x * 0.15).toFixed(1)}px, ${(y * 0.15).toFixed(1)}px, 0)`;
    });

    el.addEventListener("mouseleave", () => {
      el.style.transform = "translate3d(0, 0, 0)";
    });
  });
}

// ==========================================
// 12. INTERACTIVE BENTO SKILL MATRIX FILTERING
// ==========================================
function initTechFilters() {
  const filterBtns = document.querySelectorAll(".tech-filter-pill");
  const techCells = document.querySelectorAll(".tech-card-cell");

  if (!filterBtns.length || !techCells.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;

      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      techCells.forEach(cell => {
        const cat = cell.dataset.category;
        if (filter === "all" || cat === filter) {
          cell.classList.remove("is-hidden");
          cell.style.animation = "fadeScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards";
        } else {
          cell.classList.add("is-hidden");
        }
      });
    });
  });
}

// ==========================================
// 13. DYNAMIC CARD SPOTLIGHT BORDER HIGHLIGHT
// ==========================================
function initSpotlightCards() {
  const spotlightCards = document.querySelectorAll(".project-bento-card, .blog-bento-card, .timeline-card-body");

  spotlightCards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
  });
}

// ==========================================
// 14. RELIABLE EXTERNAL LINK HANDLER (GUARANTEES GITHUB & LINKEDIN OPEN IN ALL BROWSERS)
// ==========================================
function initExternalLinks() {
  const links = document.querySelectorAll("a[target='_blank'], .external-link");
  links.forEach(link => {
    link.addEventListener("click", (e) => {
      const url = link.getAttribute("href");
      if (!url || !url.startsWith("http")) return;

      // In framed preview environments (like IDE webviews or sandbox frames)
      // standard target="_blank" is sometimes suppressed by sandbox policies.
      // Explicitly invoke window.open to guarantee new tab launch on user click.
      try {
        if (window.self !== window.top) {
          e.preventDefault();
          window.open(url, "_blank", "noopener");
        }
      } catch (err) {
        try {
          e.preventDefault();
          window.open(url, "_blank", "noopener");
        } catch (innerErr) {
          // Native browser behavior fallback
        }
      }
    });
  });
}

// Initialize everything on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initCanvasRevealEffect();
  initCanvasCursor();
  initTheme();
  initAvatarFlip();
  initHobbies();
  initBlogModal();
  initResumeModal();
  initResumeZoom();
  initCopyButtons();
  initStickyMenuBar();
  initNavigation();
  initCard3DTilt();
  initMagneticElements();
  initTechFilters();
  initSpotlightCards();
  initExternalLinks();
});
