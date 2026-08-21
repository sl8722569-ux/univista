(function () {
  const $ = (id) => document.getElementById(id);
  const clips = JSON.parse(localStorage.getItem("uv-clips") || "[]");
  const events = JSON.parse(localStorage.getItem("uv-ev") || "[]");
  const videoClips = [];
  let stream = null;
  let recorder = null;
  let recChunks = [];
  let watching = false;
  let prevFrame = null;
  let lastMotion = 0;
  let motionTimer = null;

  const cameras = [
    { name: "This device", status: "Fully supported", note: "Browser camera via getUserMedia." },
    { name: "Shop entrance (sim)", status: "Simulated", note: "Demo camera. No physical device." },
    { name: "Gate (sim)", status: "Simulated", note: "Demo camera. No physical device." },
    { name: "Roof (example)", status: "Unsupported", note: "No adapter yet. UniVista will explain limits instead of faking support." }
  ];

  function savePriv() {
    localStorage.setItem("uv-priv", JSON.stringify({
      rec: $("p-rec").checked,
      ai: $("p-ai").checked,
      cam: $("p-cam").checked,
      voice: $("p-voice").checked
    }));
  }
  (function loadPriv() {
    try {
      const p = JSON.parse(localStorage.getItem("uv-priv") || "{}");
      if (typeof p.rec === "boolean") $("p-rec").checked = p.rec;
      if (typeof p.ai === "boolean") $("p-ai").checked = p.ai;
      if (typeof p.cam === "boolean") $("p-cam").checked = p.cam;
      if (typeof p.voice === "boolean") $("p-voice").checked = p.voice;
    } catch (e) { /* keep defaults */ }
  })();
  ["p-rec", "p-ai", "p-cam", "p-voice"].forEach((id) => $(id).onchange = savePriv);

  function show(id) {
    document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("on", x.dataset.v === id));
    document.querySelectorAll(".view").forEach((x) => x.classList.toggle("on", x.id === id));
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    $("ziva").textContent = "Ziva: opened " + id + ".";
  }
  document.querySelectorAll("nav button").forEach((b) => {
    b.onclick = () => show(b.dataset.v);
  });
  function route() {
    const h = (location.hash || "#dash").slice(1);
    if ($(h)) show(h);
  }
  window.addEventListener("hashchange", route);
  route();

  $("cam-list").innerHTML = cameras.map((c) =>
    "<li><b>" + c.name + "</b> — " + c.status + "<br>" + c.note + "</li>"
  ).join("");

  function addEvent(text) {
    events.unshift(new Date().toLocaleString() + " — " + text);
    localStorage.setItem("uv-ev", JSON.stringify(events.slice(0, 40)));
    render();
  }
  function render() {
    $("k-rec").textContent = String(clips.length);
    $("k-al").textContent = String(events.length);
    $("ev").innerHTML = events.slice(0, 20).map((e) => "<li>" + e + "</li>").join("") || "<li>No alerts.</li>";
    $("thumbs").innerHTML = clips.slice(0, 16).map((c) => "<img src=\"" + c + "\" alt=\"still\">").join("");
    $("clips-v").innerHTML = videoClips.map((v) =>
      "<li><a href=\"" + v.url + "\" download=\"" + v.name + "\">" + v.name + "</a></li>"
    ).join("") || "<li>No video clips this session. Record from Live view.</li>";
  }
  render();

  $("start").onclick = async () => {
    if (!$("p-cam").checked) {
      $("health").textContent = "Nira: enable camera in Privacy, then Start camera. Browser will ask permission.";
      show("privacy");
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      $("vid").srcObject = stream;
      $("health").textContent = "Novi: live camera Fully supported (this device). Veya can watch frames locally only.";
      addEvent("Novi: this-device camera connected (Fully supported).");
    } catch (e) {
      $("health").textContent = "Novi: camera blocked — " + e.message;
    }
  };
  $("stop").onclick = () => {
    if (recorder && recorder.state === "recording") stopRec();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    $("vid").srcObject = null;
    watching = false;
    $("watch").textContent = "Watch motion";
    $("health").textContent = "Novi: camera stopped.";
  };

  $("snap").onclick = () => {
    if (!$("p-rec").checked) {
      addEvent("Luma: snapshot blocked (privacy).");
      return;
    }
    const v = $("vid");
    const c = $("cv");
    if (!v.videoWidth) {
      $("health").textContent = "Nira: start the camera first.";
      return;
    }
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const url = c.toDataURL("image/jpeg", 0.7);
    clips.unshift(url);
    while (clips.length > 24) clips.pop();
    localStorage.setItem("uv-clips", JSON.stringify(clips));
    addEvent("Luma: local still saved on this device only.");
  };

  function stopRec() {
    if (recorder && recorder.state === "recording") recorder.stop();
    $("rec").textContent = "Record clip";
  }
  $("rec").onclick = () => {
    if (!$("p-rec").checked) {
      addEvent("Luma: recording blocked (privacy).");
      return;
    }
    if (!stream) {
      $("health").textContent = "Nira: start the camera first.";
      return;
    }
    if (recorder && recorder.state === "recording") {
      stopRec();
      return;
    }
    recChunks = [];
    try {
      recorder = new MediaRecorder(stream);
    } catch (e) {
      $("health").textContent = "Nira: this browser cannot record this stream.";
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recChunks, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const name = "univista-" + Date.now() + ".webm";
      videoClips.unshift({ url: url, name: name });
      render();
      addEvent("Luma: clip recorded on this device (download from Storage). Not uploaded.");
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
    };
    recorder.start();
    $("rec").textContent = "Stop recording";
    $("health").textContent = "Luma: recording locally…";
  };

  $("sim").onclick = () => {
    if (!$("p-ai").checked) {
      addEvent("Kira: simulated event blocked (privacy).");
      return;
    }
    addEvent("Veya/Kira: possible human-shaped motion (simulated). Not certain.");
    $("health").textContent = "Kira: simulated restricted-zone style event. Uncertainty stated.";
  };

  function motionTick() {
    if (!watching || !stream) return;
    const v = $("vid");
    const c = $("cv");
    if (!v.videoWidth) return;
    c.width = 160;
    c.height = 90;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, 160, 90);
    const frame = ctx.getImageData(0, 0, 160, 90).data;
    if (prevFrame) {
      let changed = 0;
      for (let i = 0; i < frame.length; i += 16) {
        const d = Math.abs(frame[i] - prevFrame[i]) + Math.abs(frame[i + 1] - prevFrame[i + 1]) + Math.abs(frame[i + 2] - prevFrame[i + 2]);
        if (d > 90) changed++;
      }
      if (changed > 0 && changed < 14) {
        /* tiny object / noise — ignore */
      } else if (changed >= 55 && Date.now() - lastMotion > 10000 && $("p-ai").checked) {
        lastMotion = Date.now();
        addEvent("Veya: possible person-scale motion (local filter). Not certain — could be a large shadow or pet.");
        $("health").textContent = "Veya: motion passed tiny-object filter. Kira will not claim certainty.";
      }
    }
    prevFrame = frame;
  }
  $("watch").onclick = () => {
    if (!stream) {
      $("health").textContent = "Nira: start the camera first.";
      return;
    }
    watching = !watching;
    $("watch").textContent = watching ? "Stop watching" : "Watch motion";
    if (watching) {
      prevFrame = null;
      if (!motionTimer) motionTimer = setInterval(motionTick, 280);
      $("health").textContent = "Veya: watching locally. Tiny insects, rain specks, and noise should be ignored.";
    } else {
      $("health").textContent = "Veya: motion watch off.";
    }
  };

  document.querySelectorAll(".grid-sel button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".grid-sel button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      const g = b.dataset.g;
      $("stage").className = "stage g" + g;
      $("grid-warn").classList.toggle("hidden", g !== "4");
      if (g === "4") addEvent("Nira: four-camera warning shown (CPU/RAM/GPU/network/battery/temperature).");
    };
  });

  $("clear-stills").onclick = () => {
    clips.length = 0;
    localStorage.setItem("uv-clips", "[]");
    render();
    addEvent("Luma: local stills cleared on this device.");
  };

  const chat = $("chat");
  function speak(text) {
    if (!$("p-voice").checked || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  function miraSay(t) {
    const p = document.createElement("p");
    p.textContent = "Mira: " + t;
    chat.appendChild(p);
    chat.scrollTop = chat.scrollHeight;
    speak(t);
  }
  miraSay("Hi. I can open live view, save a still, record a clip, or explain an agent. I will not claim a detection is certain.");
  $("mira-f").onsubmit = (e) => {
    e.preventDefault();
    const q = $("mira-q").value.trim();
    if (!q) return;
    const p = document.createElement("p");
    p.textContent = "You: " + q;
    chat.appendChild(p);
    $("mira-q").value = "";
    const low = q.toLowerCase();
    let a = "I can open Live view, save a local still, record a clip, or explain an agent. Cloud and Drive are off in Early Access.";
    if (/live|camera|open/.test(low)) { a = "Opening Live view. Use Start camera — Novi labels this device Fully supported."; show("live"); }
    else if (/dash/.test(low)) { a = "Opening the operations dashboard for Nexa."; show("dash"); }
    else if (/privacy|stop recording|off/.test(low)) { a = "Privacy can disable snapshots, clips, and AI events. Originals stay on this device."; show("privacy"); }
    else if (/kira|security|zone/.test(low)) a = "Kira is security AI: zones and after-hours rules later. Today: alerts with uncertainty, never fake certainty.";
    else if (/veya|human|motion|detect/.test(low)) a = "Veya watches locally if you tap Watch motion. Tiny insects and noise are filtered. Person-scale motion is reported as possible, not certain.";
    else if (/luma|storage|clip|snapshot/.test(low)) { a = "Luma keeps stills in this browser. Clips download to this device. No cloud yet."; show("storage"); }
    else if (/nexa/.test(low)) a = "Nexa is operations: cameras, recording, health. This dashboard is her Early Access surface.";
    else if (/novi|onvif|rtsp|xiaomi|arlo|v380/.test(low)) a = "Novi will add ONVIF, RTSP, and manufacturer adapters later. Status will be Fully, Partial, or Unsupported with an explanation.";
    else if (/raya|light|colour|color/.test(low)) a = "Raya will control compatible RGB lights later. Early Access does not change your bulbs.";
    else if (/aira|alarm/.test(low)) a = "Aira will play custom alarms later. Not armed in Early Access.";
    else if (/ziva|fast|launch/.test(low)) a = "Ziva opens views quickly. Try #live or #mira in the address bar, or Install as an app.";
    else if (/nira|diagnos|problem/.test(low)) a = "Nira reports health on the dashboard: camera blocked, recording privacy, four-camera load warnings.";
    else if (/sora|audio|voice detect/.test(low)) a = "Sora (audio AI) is planned for Beta: speech detection and voice-triggered recording. Not in Early Access.";
    else if (/coda|developer/.test(low)) a = "Coda helps with adapters and docs. Production deploys still need human approval.";
    else if (/tavi|test/.test(low)) a = "Tavi will simulate failures later. Today: Simulate human event on Live view.";
    else if (/mira|who are you|hello|hi/.test(low)) a = "I’m Mira, the main UniVista assistant. Warm, friendly, and I stay honest about what this Early Access can and cannot do.";
    miraSay(a);
  };

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
