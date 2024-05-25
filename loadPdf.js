const canvasEl = document.querySelector("canvas");
const canvasContext = canvasEl.getContext("2d");

document.querySelector("#pdf-upload").addEventListener("change", function (e) {
  var file = e.target.files[0];
  if (file.type != "application/pdf") {
    console.error(file.name, "is not a pdf file.");
    return;
  }

  const fileReader = new FileReader();
  fileReader.onload = function () {
    const typedarray = new Uint8Array(this.result);

    PDFJS.getDocument(typedarray).then(function (pdf) {
      console.log("the pdf has ", pdf.numPages, "page(s).");
      pdf.getPage(pdf.numPages).then(function (page) {
        const viewport = page.getViewport(2.0);
        canvasEl.height = viewport.height;
        canvasEl.width = viewport.width;

        page
          .render({
            canvasContext: canvasContext,
            viewport: viewport,
          })
          .then(function () {
            init();
          });
      });
    });
  };
  fileReader.readAsArrayBuffer(file);
});

const init = () => {
  let isDrawing = false;
  let drawMode = false;
  let moveMode = true;
  let line, points;
  let isDragging = false;
  let isAnyLineSelected = false;
  let lastPosX, lastPosY;

  const bg = canvasEl.toDataURL("image/png");
  const fabricCanvas = new fabric.Canvas("pdfcanvas");
  fabricCanvas.selection = false;

  // * Print PDF into canvas as Image
  fabric.Image.fromURL(bg, function (img) {
    img.scaleToHeight(1123);
    fabricCanvas.setHeight(1123);
    fabricCanvas.setWidth(1588);
    fabricCanvas.setBackgroundImage(
      img,
      fabricCanvas.renderAll.bind(fabricCanvas)
    );
  });

  // * Button event for draw line
  document.querySelector("#toggle-draw").addEventListener("click", function () {
    drawMode = !drawMode;
    moveMode = !moveMode;
    this.textContent = drawMode ? "Disable Drawing" : "Enable Drawing";
    // fabricCanvas.isDrawingMode = drawMode;
    fabricCanvas.selection = !drawMode;

    fabricCanvas.forEachObject(function (obj) {
      obj.selectable = !drawMode;
    });
  });

  // * Draw line mouse down Event
  fabricCanvas.on("mouse:down", function (o) {
    if (isAnyLineSelected) return;

    const evt = o.e;
    if (drawMode) {
      isDrawing = true;
      const pointer = fabricCanvas.getPointer(evt);
      points = [pointer.x, pointer.y, pointer.x, pointer.y];
      line = new fabric.Line(points, {
        strokeWidth: 2,
        fill: "red",
        stroke: "red",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
      });
      fabricCanvas.add(line);
    } else {
      if (moveMode) {
        isDragging = true;
        fabricCanvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    }
  });

  // *  Draw Line with shift key for straight line
  fabricCanvas.on("mouse:move", function (o) {
    if (isAnyLineSelected) return;

    const evt = o.e;
    // * Draw Line
    if (drawMode && isDrawing) {
      const pointer = fabricCanvas.getPointer(evt);
      const shiftPressed = evt.shiftKey; // Check if Shift key is pressed
      if (shiftPressed) {
        // Draw straight lines horizontally or vertically
        const dx = Math.abs(pointer.x - points[0]);
        const dy = Math.abs(pointer.y - points[1]);
        if (dx > dy) {
          points[2] = pointer.x;
          points[3] = points[1];
        } else {
          points[2] = points[0];
          points[3] = pointer.y;
        }
      } else {
        // Draw freely
        points[2] = pointer.x;
        points[3] = pointer.y;
      }
      line.set({
        x2: points[2],
        y2: points[3],
      });
      fabricCanvas.renderAll();
    }

    // * Move Canvas
    if (isDragging) {
      const vpt = fabricCanvas.viewportTransform;
      vpt[4] += evt.clientX - lastPosX;
      vpt[5] += evt.clientY - lastPosY;
      fabricCanvas.renderAll();
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
    }
  });

  // * Draw line mouse up Event
  fabricCanvas.on("mouse:up", function (o) {
    if (isAnyLineSelected) return;
    isDragging = false;

    if (!drawMode) return;
    isDrawing = false;
    line.setCoords();
    line.set({
      selectable: true,
      evented: true,
    });
    fabricCanvas.renderAll();
  });

  // * Disable dragging when a line is selected
  fabricCanvas.on("object:selected", function (e) {
    if (e.target instanceof fabric.Line) {
      isAnyLineSelected = true;
    }
  });

  // * Enable dragging when selection is cleared
  fabricCanvas.on("selection:cleared", function (e) {
    isAnyLineSelected = false;
  });

  /**
   *
   * @param {*} event
   * @param {*} type (in | out)
   */
  function handleZoom(event, type) {
    event.preventDefault();
    const zoomFactor = 0.1;
    let zoom = fabricCanvas.getZoom();

    type === "in" && (zoom += zoomFactor);
    type === "out" && (zoom -= zoomFactor);

    zoom = Math.min(Math.max(zoom, 0.5), 3);
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }
  //* ---------> manage zoom on mouse and keyboard start ---------->

  // *Key board ctrl + (+) or (-)
  document.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey && event.code === "Equal") ||
      (event.ctrlKey && event.code === "NumpadAdd")
    ) {
      handleZoom(event, "in");
    } else if (
      (event.ctrlKey && event.code === "Minus") ||
      (event.ctrlKey && event.code === "NumpadSubtract")
    ) {
      handleZoom(event, "out");
    }
  });

  // * Ctrl + wheel (up) or (down)
  document.addEventListener(
    "wheel",
    function (event) {
      if (event.deltaY < 0 && event.ctrlKey) {
        //* ctrl + Scroll UP (Zoom In)
        handleZoom(event, "in");
      } else if (event.deltaY > 0 && event.ctrlKey) {
        //* ctrl + Scroll Down (Zoom Out)
        handleZoom(event, "out");
      }
    },
    { passive: false }
  );

  // * (+) button click
  document
    .querySelector("#zoom-in")
    .addEventListener("click", (event) => handleZoom(event, "in"));

  // * (-) button click
  document
    .querySelector("#zoom-out")
    .addEventListener("click", (event) => handleZoom(event, "out"));

  //* <--------- manage zoom on mouse and keyboard End <---------
};
