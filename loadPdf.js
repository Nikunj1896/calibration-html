const canvasEl = document.querySelector("canvas");
const canvasContext = canvasEl.getContext("2d");

const previous = document.getElementById("previous");
const next = document.getElementById("next");
const toggleDrawBtn = document.querySelector("#toggle-draw");

let totalPage = 0;
// let pdfDocument = null;
let currentPage = 1;
let currentPdfFile = null;
let fabricCanvas;

document.querySelector("#pdf-upload").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file.type !== "application/pdf") {
    console.error(file.name, "is not a pdf file.");
    return;
  }
  currentPdfFile = file;
  currentPage = 1; // Reset to the first page
  renderPdfToCanvas(file, currentPage);
});

const renderPdfToCanvas = (pdfFile, pageNumber) => {
  const fileReader = new FileReader();
  fileReader.onload = function () {
    const typedarray = new Uint8Array(this.result);

    PDFJS.getDocument(typedarray).then(function (pdf) {
      totalPage = pdf.numPages;
      updateButtonStates();

      pdf.getPage(pageNumber).then(function (page) {
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
  fileReader.readAsArrayBuffer(pdfFile);
};

previous.addEventListener("click", function () {
  currentPage = currentPage - 1;
  initFabricCanvas();
  renderPdfToCanvas(currentPdfFile, currentPage);
});

next.addEventListener("click", function () {
  currentPage = currentPage + 1;
  initFabricCanvas();
  renderPdfToCanvas(currentPdfFile, currentPage);
});

const updateButtonStates = () => {
  previous.disabled = currentPage <= 1;
  next.disabled = currentPage >= totalPage;
};

const initFabricCanvas = () => {
  if (fabricCanvas) {
    fabricCanvas.clear();
    fabricCanvas.dispose();
  }
};

const init = () => {
  let groupLength = 0;

  let isDrawing = false;
  let drawMode = false;
  let isMoving = false;
  let isAnyLineSelected = false;
  let isDragging = false;
  let moveMode = true;

  let line, startDivider, endDivider, lineLengthText, points;

  let calibrationMode = false;
  let isCalibrationLineDrawn = false
  let calibrationPoint = 1;

  let realLineValue = 0;
  let realLineValueUnit = '';

  const deleteIcon = "./delete.png";
  const deleteImg = document.createElement('img');
  deleteImg.src = deleteIcon;
  const doneIcon = "./done.png";
  const doneImg = document.createElement('img');
  doneImg.src = doneIcon;

  const bg = canvasEl.toDataURL("image/png");
  fabricCanvas = new fabric.Canvas("pdfcanvas");
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

  // * Draw line mouse down Event
  fabricCanvas.on("mouse:down", function (o) {
    if (isAnyLineSelected) return;
    if (isCalibrationLineDrawn) return;

    const evt = o.e;
    if (drawMode) {
      isDrawing = true;
      const pointer = fabricCanvas.getPointer(evt);
      points = [pointer.x, pointer.y, pointer.x, pointer.y];

      line = new fabric.Line(points, {
        strokeWidth: 0.3,
        fill: "black",
        stroke: "black",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        lockSkewingX: true,
        lockSkewingY: true,
        id: groupLength,
        name: `group-${groupLength}-line`,
      });

      startDivider = makeDivider(line.get("x1"), line.get("y1"), line);
      endDivider = makeDivider(line.get("x2"), line.get("y2"), line);

      lineLengthText = makeLineLengthText(line);

      line.minions = [startDivider, endDivider, lineLengthText];

      fabricCanvas.add(line, startDivider, endDivider, lineLengthText);
      if (calibrationMode) {
        const backgroundLayer = document.querySelector('#background-layer')
        backgroundLayer.style.display = 'none';
        // for (let i = 0; i < line.length; i++) {
        //   fabricCanvas.remove(lines[i]);
        //   fabricCanvas.discardActiveObject(line)
        //   fabricCanvas.renderAll();
        // }
        // fabricCanvas.deactivateAll();
      }
    } else {
      if (moveMode) {
        isDragging = true;
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
    if (calibrationMode) {
      isCalibrationLineDrawn = true
      //fabricCanvas.setActiveObject(line)
    }
  });

  fabricCanvas.on("selection:created", function (e) {
    handleLineObjectSelection(e.selected[0]);
  });

  fabricCanvas.on("selection:updated", function (e) {
    handleLineObjectSelection(e.selected[0]);
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
      height: 0.5,
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

  function handleLineObjectSelection(selectedLine) {
    isAnyLineSelected = true;

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
      if (isCalibrationLineDrawn && calibrationMode) {
        fabric.Object.prototype.controls.deleteControl = new fabric.Control({
          x: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? 0.1 : 1.2, // Horizontal or vertical adjustment
          y: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -2.0 : -0.55,
          offsetY: 16,
          cursorStyle: 'pointer',
          mouseUpHandler: deleteObject,
          render: renderdeleteIcon,
          cornerSize: 24
        });

        fabric.Object.prototype.controls.doneControl = new fabric.Control({
          x: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -0.1 : -1.2, // Horizontal or vertical adjustment
          y: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -2.0 : -0.55,
          offsetY: 16,
          cursorStyle: 'pointer',
          mouseUpHandler: doneObject,
          render: renderDoneIcon,
          cornerSize: 24
        });
      } else {
        if (selectedLine.controls.deleteControl) delete selectedLine.controls.deleteControl;
        if (selectedLine.controls.doneControl) delete selectedLine.controls.doneControl;
      }
      fabricCanvas.renderAll();
    }
  }

  function deleteObject() {
    if (confirm("Are you sure you want to delete this line?")) {
      removeLine(line)
      document.getElementById('popup').style.display = 'none'
      document.getElementById('calibration-btn').style.backgroundColor = '#EFEFEF'
      moveMode = true;
      drawMode = true;
      calibrationMode = false;
      isCalibrationLineDrawn = false;
    }
  }

  function renderdeleteIcon(ctx, left, top, styleOverride, fabricObject) {
    var size = this.cornerSize;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(deleteImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function doneObject() {
    document.getElementById('popup').style.display = 'flex'
    const lengthText = updateMinions(line)
    document.getElementById('pdfLineLengthValue').innerHTML = lengthText.toFixed(2) + 'px'
  }

  function renderDoneIcon(ctx, left, top, styleOverride, fabricObject) {
    var size = this.cornerSize;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(doneImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  fabricCanvas.on("selection:created", function (e) {
    const selectedObject = e.selected[0];
    if (calibrationMode && isCalibrationLineDrawn && selectedObject && selectedObject.type === "line") {
      handleLineObjectSelection(selectedObject);
    }
  });

  function makeLineLengthText(line) {
    const text = new fabric.Text("", {
      fontSize: 6,
      height: 10,
      fontFamily: 'Candara Light',
      fontWeight : 1000,
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
      text: `${convertPixelLength(length, realLineValueUnit === "" ? 'px' : realLineValueUnit)}`,
    });
  }

  function calculatePerpendicularAngle(x1, y1, x2, y2) {
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;
  }

  function updateMinions(line) {
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
    ) * calibrationPoint;

    line.minions[2]
      .set({
        text: `${convertPixelLength(length, realLineValueUnit === "" ? 'px' : realLineValueUnit)}`,
        left: (startTransformed.x + endTransformed.x) / 2,
        top: (startTransformed.y + endTransformed.y) / 2,
      })
      .setCoords();

    return length
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

  function convertRealLineLength(realLineValue, realLineValueUnit) {
    const inchesToPixels = 96;
    const mmToPixels = 1151.9999999832 / 304.8; // 1 mm = 1/25.4 inches, 1 inch = 96 pixels, hence 1 mm = (96 / 25.4) pixels
    const cmToPixels = 1151.9999999832 / 30.48; // 1 cm = 10 mm, hence conversion factor for cm
    const mToPixels = 1151.9999999832 / 0.3048; // 1 m = 1000 mm, hence conversion factor for m

    switch (realLineValueUnit) {
      case 'ft':
        return realLineValue * 1151.9999999832;
      case 'ftin':
        // Split the input string into feet and inches
        const [feet, inches] = realLineValue.split('-').map(Number);
        // Convert feet to inches and add the extra inches
        const totalInches = (feet * 12) + inches;
        // Convert inches to pixels
        return totalInches * inchesToPixels;
      case 'mm':
        return realLineValue * mmToPixels;
      case 'cm':
        return realLineValue * cmToPixels;
      case 'm':
        return realLineValue * mToPixels;
      default:
        return realLineValue;
    }
  }

  function convertPixelLength(pixelValue, realLineValueUnit) {
    const pixelsToInches = 1 / 96;
    const pixelsToMm = 304.8 / 1151.9999999832; // 1 pixel = (25.4 / 96) mm
    const pixelsToCm = 30.48 / 1151.9999999832; // 1 pixel = (2.54 / 96) cm
    const pixelsToM = 0.3048 / 1151.9999999832; // 1 pixel = (0.0254 / 96) m
    const pixelsToFt = 1 / 1151.9999999832; // 1 pixel = (1 / 1151.9999999832) ft

    let result = pixelValue;
    switch (realLineValueUnit) {
      case 'ft':
        result = pixelValue * pixelsToFt;
        break;
      case 'ftin':
        const totalInches = pixelValue * pixelsToInches;
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        const preciosion = inches - Math.floor(inches);
        
        if(precisionvalue === "1/2"){
          if(preciosion.toFixed(2) >= 0 && preciosion.toFixed(2) <=0.50){
            var ans = "1/2"
          }else if(preciosion.toFixed(2) >= 0.50 && preciosion.toFixed(2) <= 1.00){
            var ans = "2/2"
          }
        }else if(precisionvalue === "1/4"){
          if(preciosion.toFixed(2) <= 0.25 && preciosion.toFixed(2) >=0){
            var ans = "1/4"
          }else if(preciosion.toFixed(2) >= 0.25 && preciosion.toFixed(2) <= 0.50){
            var ans = "2/4"
          }
          else if(preciosion.toFixed(2) >= 0.50 && preciosion.toFixed(2) <= 0.75){
            var ans = "3/4"
          }else if(preciosion.toFixed(2) >= 0.75 && preciosion.toFixed(2) <= 1.00){
            var ans = "4/4"
          }
        }else if(precisionvalue === "1/8"){
          if(preciosion.toFixed(2) >=0 && preciosion.toFixed(2) <= 0.12){
            var ans = "1/8";
          }else if(preciosion.toFixed(2) >= 0.13 && preciosion.toFixed(2) <= 0.25){
            var ans = "2/8;"
          }else if(preciosion.toFixed(2) >= 0.26 && preciosion.toFixed(2) <= 0.37){
            var ans = "3/8";
          }else if(preciosion.toFixed(2) >= 0.38 && preciosion.toFixed(2) <= 0.50){
            var ans = "4/8";
          }else if(preciosion.toFixed(2) >= 0.51 && preciosion.toFixed(2) <= 0.62){
            var ans = "5/8";
          }else if(preciosion.toFixed(2) >= 0.63 && preciosion.toFixed(2) <= 0.75){
            var ans = "6/8";
          }else if(preciosion.toFixed(2) >= 0.76 && preciosion.toFixed(2) <= 0.87){
            var ans = "7/8";
          }else if(preciosion.toFixed(2) >= 0.88 && preciosion.toFixed(2) <= 1.00){
            var ans = "8/8";
          }
        }else if(precisionvalue === "1/16"){
          if(preciosion.toFixed(2) >= 0 && preciosion.toFixed(2) <= 0.0625){
            var ans = "1/16";
          }else if(preciosion.toFixed(2) >= 0.0625 && preciosion.toFixed(2) <= 0.125){
            var ans = "2/16"
          }else if(preciosion.toFixed(2) >= 0.125 && preciosion.toFixed(2) <= 0.187){
            var ans = "3/16"
          }else if(preciosion.toFixed(2) >= 0.187 && preciosion.toFixed(2) <= 0.25){
            var ans = "4/16"
          }else if(preciosion.toFixed(2) >= 0.25 && preciosion.toFixed(2) <= 0.312){
            var ans = "5/16"
          }else if(preciosion.toFixed(2) >= 0.312 && preciosion.toFixed(2) <= 0.375){
            var ans = "6/16"
          }else if(preciosion.toFixed(2) >= 0/375 && preciosion.toFixed(2) <= 0.437){
            var ans = "7/16"
          }else if(preciosion.toFixed(2) >= 0.437 && preciosion.toFixed(2) <= 0.5){
            var ans = "8/16"
          }else if(preciosion.toFixed(2) >= 0.5 && preciosion.toFixed(2) <= 0.562){
            var ans = "9/16"
          }else if(preciosion.toFixed(2) >= 0.562 && preciosion.toFixed(2) <= 0.625){
            var ans = "10/16"
          }else if(preciosion.toFixed(2) >= 0.625 && preciosion.toFixed(2) <= 0.687){
            var ans = "11/16"
          }else if(preciosion.toFixed(2) >= 0.687 && preciosion.toFixed(2) <= 0.75){
            var ans = "12/16"
          }else if(preciosion.toFixed(2) >= 0.75 && preciosion.toFixed(2) <= 0.812){
            var ans = "13/16"
          }else if(preciosion.toFixed(2) >= 0.812 && preciosion.toFixed(2) <= 0.875){
            var ans = "14/16"
          }else if(preciosion.toFixed(2) >= 0.875 && preciosion.toFixed(2) <= 0.937){
            var ans = "15/16"
          }else if(preciosion.toFixed(2) >= 0.937 && preciosion.toFixed(2) <= 1.00){
            var ans = "16/16"
          }
        }
        result = `${feet}'-${inches.toFixed(0)}  ${ans}"`;
        break;
      case 'mm':
        result = pixelValue * pixelsToMm;
        break;
      case 'cm':
        result = pixelValue * pixelsToCm;
        break;
      case 'm':
        result = pixelValue * pixelsToM;
        break;
      default:
        result = pixelValue;
        break;
    }
    if (realLineValueUnit === 'ftin') {
      return result
    } else {
      return result.toFixed(2);
    }
  }

  function countCalibrationPoint(pdfLineLengthValue, realLineLengthValue) {
    return calibrationPoint = realLineLengthValue / pdfLineLengthValue
  }

  function calculateLineLength(line) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    return Math.sqrt(dx * dx + dy * dy) * calibrationPoint;
  }

  function removeLine(line) {
    line.minions.forEach((minion) => {
      fabricCanvas.remove(minion);
    });
    fabricCanvas.remove(line);
    fabricCanvas.renderAll();
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

    zoom = Math.min(Math.max(zoom, 0.5), 8);
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }

  //* ---------> manage zoom on mouse and keyboard start ---------->

  // * Button event for draw line
  toggleDrawBtn.addEventListener("click", function () {
    drawMode = !drawMode;
    moveMode = true;
    this.textContent = drawMode ? "Measure on" : "Measure";
    // fabricCanvas.selection = !drawMode;

    fabricCanvas.forEachObject(function (obj) {
      obj.selectable = !drawMode;
    });
  });

  document.addEventListener("keydown", (event) => {
    // *Key board ctrl + (+) or (-)
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

  // * Event listeners for wheel event for panning
  document.addEventListener(
    "wheel",
    function (event) {
      if (event.ctrlKey) return;

      if (event.shiftKey || event.metaKey) {
        // Horizontal scrolling when Shift key is pressed
        const delta = Math.sign(event.deltaY) * 30;
        fabricCanvas.relativePan(new fabric.Point(delta, 0));
      } else {
        // Vertical scrolling otherwise
        const delta = Math.sign(event.deltaY) * -30;
        fabricCanvas.relativePan(new fabric.Point(0, delta));
      }
      event.preventDefault();
    },
    { passive: false }
  );

  // document
  //   .querySelector("#download-pdf")
  //   .addEventListener("click", async function () {
  //     // const fabricCanvas = document.querySelector("canvas").fabric;
  //     const dataUrl = fabricCanvas.toDataURL({
  //       format: "png",
  //       multiplier: 2, // adjust the resolution if needed
  //     });

  //     const pdfDoc = await PDFLib.PDFDocument.create();
  //     const page = pdfDoc.addPage([canvasEl.width, canvasEl.height]);
  //     const pngImage = await pdfDoc.embedPng(dataUrl);
  //     page.drawImage(pngImage, {
  //       x: 0,
  //       y: 0,
  //       width: canvasEl.width,
  //       height: canvasEl.height,
  //     });

  //     const pdfBytes = await pdfDoc.save();
  //     const blob = new Blob([pdfBytes], { type: "application/pdf" });
  //     const url = URL.createObjectURL(blob);
  //     const link = document.createElement("a");
  //     link.href = url;
  //     link.download = "modified.pdf";
  //     link.click();
  //     URL.revokeObjectURL(url);
  //   });

  //* button event the set the calibration
  if (calibrationPoint === 1) {
    document.querySelector("#calibration-btn").addEventListener('click', function () {
      calibrationMode = true;
      moveMode = false;
      drawMode = true;
      calibrationMode ? this.style.backgroundColor = 'green' : this.style.backgroundColor = '#EFEFEF'

      var message = document.getElementById('message');
        message.style.display = 'block'; // Show the message
      setTimeout(function() {
          message.style.display = 'none';
      },5000);

    
      const backgroundLayer = document.querySelector('#background-layer')
      backgroundLayer.style.display = 'block';
      backgroundLayer.style.backgroundColor = '#3f85ef61';

      fabricCanvas.forEachObject(function (obj) {
        obj.selectable = !drawMode;
      });
    })
  } else {
    alert('calibration point is already set')
  }

  //* Button event to set the calibraation point
  document.querySelector('#setCalibration-value-btn').addEventListener('click', function () {
    realLineValueUnit = document.getElementById('realLengthUnitSelect').value;

    if (realLineValueUnit === "ftin") {
      realLineValue = document.getElementById('realLineLengthValue').value;

      precisionvalue = document.getElementById('pre').value;
      

      var match = /^(\d+)'\-(\d+)"$/.exec(realLineValue);
      var match1 = /^(\d+)'\-(\d+)''$/.exec(realLineValue);
      if (match) {
        var feet = parseInt(match[1], 10);
        var inches = parseInt(match[2], 10);
        realLineValue = feet + '-' + inches;
      } else if(match1){
        var feet = parseInt(match1[1], 10);
        var inches = parseInt(match1[2], 10);
        realLineValue = feet + '-' + inches;
      }else {
        alert("Value must be in the format 00'-00\"");
      }
    } else {
      realLineValue = document.getElementById('realLineLengthValue').value;
    }

    const realLineLengthValue = convertRealLineLength(realLineValue, realLineValueUnit)
    const pdfLineLengthValue = updateMinions(line)

    countCalibrationPoint(pdfLineLengthValue, realLineLengthValue)

    document.getElementById('popup').style.display = 'none'
    document.getElementById('calibration-btn').style.backgroundColor = '#EFEFEF'
    calibrationMode = false;
    isCalibrationLineDrawn = false;
    removeLine(line)
    fabricCanvas.discardActiveObject(line)
    moveMode = true;
    drawMode = true;
  })

  //* Button event the close the popup box
  document.querySelector('#popup-close-btn').addEventListener('click', function () {
    calibrationMode = false;
    isCalibrationLineDrawn = false;
    document.getElementById('popup').style.display = 'none'
    document.getElementById('calibration-btn').style.backgroundColor = '#EFEFEF'
    removeLine(line)
    moveMode = true;
    drawMode = false;
  })

  document.querySelector('#cleanCalibration-value-btn').addEventListener('click', function () {
    calibrationMode = false;
    isCalibrationLineDrawn = false;
    calibrationPoint = 1;
    isDrawing = false;
    drawMode = false;
    isMoving = false;
    isDragging = false;
    moveMode = true;
    document.getElementById('calibration-btn').style.backgroundColor = '#EFEFEF'
    // removeLine(line)
    realLineValue = 0;
    pdfLineValue = 0;
    realLineValueUnit = '';
  })

  document.querySelector('#Clearviewport').addEventListener('click',function(){

    const backgroundLayer = document.querySelector('#background-layer')
    backgroundLayer.style.display = 'none';

    var message = document.getElementById('message');
    message.style.display = 'none';
  })

  fabric.Object.prototype.padding = 10;
  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerStyle = "circle";
};