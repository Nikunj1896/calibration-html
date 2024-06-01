const canvasEl = document.querySelector("canvas");
const canvasContext = canvasEl.getContext("2d");

const previousBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");

let totalPage = 1;
let currentPage = 1;
let currentPdfFile = null;
let fabricCanvas;

document.querySelector("#pdf-upload").addEventListener("change", function (e) {
  cleanCanvas();
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
        const viewport = page.getViewport(4.0);
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

previousBtn.addEventListener("click", function () {
  currentPage = currentPage - 1;
  cleanCanvas();
  renderPdfToCanvas(currentPdfFile, currentPage);
});

nextBtn.addEventListener("click", function () {
  currentPage = currentPage + 1;
  cleanCanvas();
  renderPdfToCanvas(currentPdfFile, currentPage);
});

const updateButtonStates = () => {
  previousBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPage;
};

const cleanCanvas = () => {
  if (fabricCanvas) {
    fabricCanvas.clear();
    fabricCanvas.dispose();
  }
};

const init = () => {
  let isDrawing = false;
  let drawMode = false;
  let isMoving = false;
  let isAnyLineSelected = false;
  let isDragging = false;
  let moveMode = true;
  let groupLength = 0;
  let line, startDivider, endDivider, lineLengthText, points;
  let calibrationMode = false;
  let calibrationPoint = 1;
  let realLineValue = 0;
  let realLineValueUnit = '';

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
    if (calibrationMode) {
      document.getElementById('popup').style.display = 'flex'
      document.getElementById('pdfLineLengthValue').innerHTML = calculateLineLength(line).toFixed(2) + 'px'
    }
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
      height: 0.3,
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
      fontSize: 9,
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
      text: `${convertPixelLength(length, realLineValueUnit === "" ? 'px' : realLineValueUnit)} ${realLineValueUnit === "" ? 'px' : realLineValueUnit}`,
    });
  }

  function calculateLineLength(line) {
    const dx = line.x2 - line.x1;
    console.log("Hello moto",dx) ;
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
    ) * calibrationPoint;

    line.minions[2]
      .set({
        text: `${convertPixelLength(length, realLineValueUnit === "" ? 'px' : realLineValueUnit)} ${realLineValueUnit === "" ? 'px' : realLineValueUnit}`,
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

  function convertRealLineLength(realLineValue, realLineValueUnit) {
    const inchesToPixels = 96;
    const mmToPixels = 1151.9999999832 / 304.8; // 1 mm = 1/25.4 inches, 1 inch = 96 pixels, hence 1 mm = (96 / 25.4) pixels
    const cmToPixels = 1151.9999999832 / 30.48; // 1 cm = 10 mm, hence conversion factor for cm
    const mToPixels = 1151.9999999832 / 0.3048; // 1 m = 1000 mm, hence conversion factor for m

    switch (realLineValueUnit) {
      case 'ft':
        return realLineValue * 1151.9999999832;
      case 'ft-in':
        // Split the input string into feet and inches
        const [feet, inches] = realLineValue.split('-').map(Number);///////////////////////////////----------------->
        console.log(feet);
        console.log(inches);
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
      case 'ft-in':
        const totalInches = pixelValue * pixelsToInches;
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        result = `${feet}'-${inches.toFixed(2)}"`;  // use toFixed(2) for the .00 value
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
    if (realLineValueUnit === 'ft-in') {
      return result
    } else {
      return result.toFixed(2);
    }
  }

  function countCalibrationPoint(pdfLineLengthValue, realLineLengthValue) {
    console.log('calibrationPoint', calibrationPoint)
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

    zoom = Math.min(Math.max(zoom, 1), 10);
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }
  //* ---------> manage zoom on mouse and keyboard start ---------->

  // * Button event for draw line
  document.querySelector("#toggle-draw").addEventListener("click", function () {
    drawMode = !drawMode;
    moveMode = !moveMode;
    this.textContent = drawMode ? "Measure On" : "Measure";
    this.style.backgroundColor = drawMode ? "yellow" : "";
    fabricCanvas.selection = !drawMode;

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
  document.addEventListener("wheel", function (event) {
    // console.log(event);
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
    //event.preventDefault();
  });

  // download the PDF
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
  document.querySelector("#calibration-btn").addEventListener('click', function () {
    calibrationMode = true;
    moveMode = false;
    drawMode = true;
    if (calibrationMode) {
      this.style.backgroundColor = 'green'
    }
    fabricCanvas.forEachObject(function (obj) {
      obj.selectable = !drawMode;
    });
  })

  // calibartion button of popup box --->> with adding validation for ft-in
  document.querySelector('#setCalibration-value-btn').addEventListener('click', function () {

    
    realLineValueUnit = document.getElementById('realLengthUnitSelect').value;

    
    if (realLineValueUnit === "ft-in") {
    
      var realLineValue = document.getElementById('realLineLengthValue').value;

      var match = /^(\d+)'\-(\d+)"$/.exec(realLineValue);
        if (match) {
          
          realLineValue = match[1] + '-' + match[2];
      } else {
          
          alert("Value must be in the format 00'-00\"");
      }
  } else {
      var realLineValue = document.getElementById('realLineLengthValue').value;
  }
  

    const realLineLengthValue = convertRealLineLength(realLineValue, realLineValueUnit)
    const pdfLineLengthValue = calculateLineLength(line)
    console.log("pdfLineLengthValue", pdfLineLengthValue, "realLineLengthValue", realLineLengthValue,)

    countCalibrationPoint(pdfLineLengthValue, realLineLengthValue)
    console.log('calibrationPoint', calibrationPoint)

    document.getElementById('popup').style.display = 'none'
    document.getElementById('calibration-btn').style.backgroundColor = '#EFEFEF'
    calibrationMode = false;
    removeLine(line)
    moveMode = true;
    drawMode = false;
  })

  //* Button event the close the popup box
  document.querySelector('#popup-close-btn').addEventListener('click', function () {
    calibrationMode = false;
    document.getElementById('popup').style.display = 'none'
    document.getElementById('calibration-btn').style.backgroundColor = '#EFEFEF'
    removeLine(line)
    moveMode = true;
    drawMode = false;
  })
  fabric.Object.prototype.padding = 10;
  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerStyle = "circle";
  

  document.getElementById('realLengthUnitSelect').addEventListener('change', function () {
    const unit = this.value;
    let placeholderText = '00.00';
    if (unit === 'ft') {
        placeholderText = '00.00';
    } else if (unit === 'ft-in') {
        placeholderText = '00\'-00"';
    } else {
        placeholderText = '00.00';
    }
    document.getElementById('realLineLengthValue').setAttribute('value', placeholderText);
});
};
