const canvasEl = document.querySelector("canvas");
const canvasContext = canvasEl.getContext("2d"); 

const previous = document.getElementById('previous');
const next = document.getElementById('next');

let pdfDocument = null;
let currentPage = 1;
let totalPages = 0;

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
      pdfDocument = pdf;
      console.log("The PDF has", pdf.numPages, "page(s).");
      renderPage(currentPage);
    });
  };
  fileReader.readAsArrayBuffer(file);
});

const renderPage = (pageNumber) => {
  pdfDocument.getPage(pageNumber).then(function (page) {
    const viewport = page.getViewport(2.0);
    canvasEl.height = viewport.height;
    canvasEl.width = viewport.width;

    const renderContext = {
      canvasContext: canvasContext,
      viewport: viewport,
    };

    page.render(renderContext).then(function () {
        canvasEl.toBlob(function(blob) {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = function() {
            const dataUrl = reader.result;
            updateBackgroundImage(dataUrl);  // Update the background image with the current page image
          };
        });
      });
  });
};

previous.addEventListener('click', function () {
  if (currentPage <= 1) {
   return;
  }
  currentPage--;
  renderPage(currentPage);
});

next.addEventListener('click', function () {
  if (currentPage >= pdfDocument.numPages) {
    return;
  }
  currentPage++;
  renderPage(currentPage);
});


  let isDrawing = false;
  let drawMode = false;
  let isMoving = false;

  let isAnyLineSelected = false;

  let isDragging = false;
  let moveMode = true;

  let groupLength = 0;
  let line, startDivider, endDivider, lineLengthText, points;

  const bg = canvasEl.toDataURL("image/png");
  const fabricCanvas = new fabric.Canvas("pdfcanvas");
  fabricCanvas.selection = false;

  function updateBackgroundImage(imageSrc) {
    fabric.Image.fromURL(imageSrc, function (img) {
      img.scaleToHeight(1123);
      fabricCanvas.setHeight(1123);
      fabricCanvas.setWidth(1588);
      fabricCanvas.setBackgroundImage(
        img,
        fabricCanvas.renderAll.bind(fabricCanvas)
      );
    });
  }

  // * Draw line mouse down Event
  fabricCanvas.on("mouse:down", function (o) {
    if (isAnyLineSelected) return;

    const evt = o.e;
    if (drawMode) {
      isDrawing = true;
      const pointer = fabricCanvas.getPointer(evt);
      points = [pointer.x, pointer.y, pointer.x, pointer.y];

      line = new fabric.Line(points, {
        strokeWidth: 1,
        fill: "red",
        stroke: "red",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        id: groupLength,
        name: `group-${groupLength}-line`,
      });

      startDivider = makeDivider(line.get("x1"), line.get("y1"), line);
      endDivider = makeDivider(line.get("x2"), line.get("y2"), line);

      lineLengthText = makeLineLengthText(line);

      line.minions = [startDivider, endDivider, lineLengthText];

      fabricCanvas.add(line, startDivider, endDivider, lineLengthText);
    } else {
      if (moveMode) {
        isDragging = true;
        fabricCanvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    }
  });

  // * Draw Line with shift key for straight line
  fabricCanvas.on("mouse:move", function (o) {
    if (isAnyLineSelected) return;
    const evt = o.e;
    // * Draw Line
    if (drawMode && isDrawing) {
      isMoving = true;
      const pointer = fabricCanvas.getPointer(evt);

      // const shiftPressed = evt.shiftKey; // Check if Shift key is pressed
      // if (true) {
      //* Draw straight lines horizontally or vertically
      const dx = Math.abs(pointer.x - points[0]);
      const dy = Math.abs(pointer.y - points[1]);
      if (dx > dy) {
        points[2] = pointer.x;
        points[3] = points[1];
      } else {
        points[2] = points[0];
        points[3] = pointer.y;
      }

      line.set({
        x2: points[2],
        y2: points[3],
      });
      updateLineLengthText(line, lineLengthText);
      endDivider.set({ left: points[2], top: points[3] });

      endDivider.set({
        left: points[2],
        top: points[3],
        angle: calculatePerpendicularAngle(
          points[0],
          points[1],
          points[2],
          points[3]
        ),
      });
      startDivider.set({
        angle: calculatePerpendicularAngle(
          points[0],
          points[1],
          points[2],
          points[3]
        ),
      });

      fabricCanvas.renderAll();
    }

    // * Move Canvas
    if (isDragging) {
      const dx = evt.movementX;
      const dy = evt.movementY;

      //* Move the canvas and all objects (lines) by the same amount
      fabricCanvas.relativePan(new fabric.Point(dx, dy));
      fabricCanvas.renderAll();
    }
  });

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
    startDivider.setCoords();
    endDivider.setCoords();
    startDivider.set({
      selectable: false,
      evented: false,
      angle: calculatePerpendicularAngle(
        line.get("x1"),
        line.get("y1"),
        line.get("x2"),
        line.get("y2")
      ),
    });
    endDivider.set({
      selectable: false,
      evented: false,
      angle: calculatePerpendicularAngle(
        line.get("x1"),
        line.get("y1"),
        line.get("x2"),
        line.get("y2")
      ),
    });

    setRelationship(line);

    if (!isMoving) {
      fabricCanvas.remove(line);
      fabricCanvas.remove(startDivider);
      fabricCanvas.remove(endDivider);
      fabricCanvas.remove(lineLengthText);
    }
    fabricCanvas.renderAll();
    groupLength += groupLength;
    isMoving = false;
  });

  fabricCanvas.on("object:selected", function (e) {
    isAnyLineSelected = true;
    const selectedLine = e.target;
    if (selectedLine && selectedLine.type === "line") {
      const { x1, y1, x2, y2 } = selectedLine;
      if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
        //* Horizontal line
        selectedLine.setControlsVisibility({
          ml: true, //middle-left
          mr: true, //middle-right
          tl: false, //top-left
          tr: false, //top-right
          bl: false, //bottom-left
          br: false, //bottom-right
          mt: false, //middle-top
          mb: false, //middle-bottom
          mtr: true, //rotation-pointer
        });
      } else {
        //* Vertical line
        selectedLine.setControlsVisibility({
          tl: false, //top-left
          tr: false, //top-right
          ml: false, //middle-left
          mr: false, //middle-right
          bl: false, //bottom-left
          br: false, //bottom-right
          mt: true, //middle-top
          mb: true, //middle-bottom
          mtr: true, //rotation-pointer
        });
      }
    }
    fabricCanvas.renderAll();
  });

  fabricCanvas.on("selection:cleared", function (e) {
    isAnyLineSelected = false;
  });

  fabricCanvas.on("object:moving", function (o) {
    updateMinions(o.target);
  });

  fabricCanvas.on("object:rotating", function (o) {
    updateMinions(o.target);
  });

  fabricCanvas.on("object:scaling", function (o) {
    updateMinions(o.target);
  });

  function makeDivider(left, top, line) {
    var divider = new fabric.Rect({
      left: left,
      top: top,
      width: 15,
      height: 1,
      fill: "#666",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      id: groupLength,
      name: `group-${groupLength}-divider`,
    });
    divider.hasControls = divider.hasBorders = false;
    divider.line = line;
    return divider;
  }

  function makeLineLengthText(line) {
    const text = new fabric.Text("", {
      fontSize: 14,
      height: 10,
      fill: "#000",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      backgroundColor: "white",
      id: groupLength,
      name: `group-${groupLength}-text`,
    });
    updateLineLengthText(line, text);
    return text;
  }

  function updateLineLengthText(line, text) {
    const length = calculateLineLength(line);
    const centerX = (line.x1 + line.x2) / 2;
    const centerY = (line.y1 + line.y2) / 2;
    text.set({
      left: centerX,
      top: centerY,
      text: length.toFixed(2)  + " px",
    });
  }

  function calculateLineLength(line) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function calculatePerpendicularAngle(x1, y1, x2, y2) {
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;
  }

  
  function updateMinions(line) {
    // if (!line.minions) return;

    // const bossTransform = line.calcTransformMatrix();
    // line.minions.forEach((o) => {
    //   if (!o.relationship) return;

    //   const newTransform = fabric.util.multiplyTransformMatrices(
    //     bossTransform,
    //     o.relationship
    //   );
    //   const opt = fabric.util.qrDecompose(newTransform);

    //   o.set({
    //     flipX: false,
    //     flipY: false,
    //   });
    //   o.setPositionByOrigin(
    //     { x: opt.translateX, y: opt.translateY },
    //     "center",
    //     "center"
    //   );
    //   o.set(opt);
    //   o.setCoords();
    // });
    if (!line.minions) return;
    const points = line.calcLinePoints();
    const startPoint = new fabric.Point(points.x1, points.y1);
    const endPoint = new fabric.Point(points.x2, points.y2);
    const transformMatrix = line.calcTransformMatrix();
    const startTransformed = fabric.util.transformPoint(
      startPoint,
      transformMatrix
    );
    const endTransformed = fabric.util.transformPoint(
      endPoint,
      transformMatrix
    );

    const angle = calculatePerpendicularAngle(
      startTransformed.x,
      startTransformed.y,
      endTransformed.x,
      endTransformed.y
    );

    line.minions[0]
      .set({ left: startTransformed.x, top: startTransformed.y, angle: angle })
      .setCoords();
    line.minions[1]
      .set({ left: endTransformed.x, top: endTransformed.y, angle: angle })
      .setCoords();

    const length = Math.sqrt(
      Math.pow(endTransformed.x - startTransformed.x, 2) +
        Math.pow(endTransformed.y - startTransformed.y, 2)
    );

    line.minions[2]
      .set({
        text: length.toFixed(2),
        left: (startTransformed.x + endTransformed.x) / 2,
        top: (startTransformed.y + endTransformed.y) / 2,
      })
      .setCoords();
  }

  function setRelationship(line) {
    const bossTransform = line.calcTransformMatrix();
    const invertedBossTransform = fabric.util.invertTransform(bossTransform);

    line.minions.forEach((o) => {
      const desiredTransform = fabric.util.multiplyTransformMatrices(
        invertedBossTransform,
        o.calcTransformMatrix()
      );
      o.relationship = desiredTransform;
    });
  }

  /**
   * @param {*} event
   * @param {*} type (in | out)
   */
  function handleZoom(event, type) {
    event.preventDefault();
    const zoomFactor = 0.1;
    let zoom = fabricCanvas.getZoom();

    type === "in" && (zoom += zoomFactor);
    type === "out" && (zoom -= zoomFactor);

    zoom = Math.min(Math.max(zoom, 0.5), );
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }
  //* ---------> manage zoom on mouse and keyboard start ---------->

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
    } else if (event.key === "Delete" || event.key === "Backspace") {
      // Delete the selected object (line)
      var activeObject = fabricCanvas.getActiveObject();
      if (activeObject && activeObject.type === "line") {
        activeObject.minions.forEach((minion) => {
          fabricCanvas.remove(minion);
        });
        fabricCanvas.remove(activeObject);
        fabricCanvas.renderAll();
      }
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

  fabric.Object.prototype.padding = 10;
  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerStyle = "circle";

