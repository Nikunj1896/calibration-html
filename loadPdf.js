fabric.Object.prototype.padding = 10;
fabric.Object.prototype.transparentCorners = false;
fabric.Object.prototype.cornerStyle = "circle";

const canvasEl = document.querySelector("canvas");
const canvasContext = canvasEl.getContext("2d");

const previous = document.getElementById("previous");
const next = document.getElementById("next");
const toggleDrawBtn = document.querySelector("#toggle-draw");

const deleteIcon = "./delete.png";
const deleteImg = document.createElement("img");
deleteImg.src = deleteIcon;
const doneIcon = "./done.png";
const doneImg = document.createElement("img");
doneImg.src = doneIcon;

let totalPage = 0;
let currentPage = 1;
let currentPdfFile = null;
let realLineValueUnit = "";
let calibrationPoint = 1;
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
  let isDrawing = false; // Flag to indicate whether a line is currently being drawn
  let drawMode = false; // Flag to indicate whether the canvas is in draw mode
  let isMoving = false; // Flag to indicate whether the user is drawing the line
  let isAnyLineSelected = false; // Flag to indicate whether is any object is selected or not
  let isDragging = false; // Flag to indicate whether the canvas is currently being dragged
  let moveMode = true; // Flag to indicate whether the canvas is in move mode

  let line, startDivider, endDivider, lineLengthText, points;

  let calibrationMode = false; // Flag to indicate whether the canvas is in calibration mode
  let isCalibrationPointAAdded = false;
  let isCalibrationPointBAdded = false;
  let isCalibrationLineDrawn = false; // Flag to indicate whether the calibration line  has drawn or not

  let realLineValue = 0;

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
    const pointer = fabricCanvas.getPointer(evt);
    points = [pointer.x, pointer.y, pointer.x, pointer.y];

    if (calibrationMode) {
      // message.style.display = "none";
      const backgroundLayer = document.querySelector("#background-layer");
      backgroundLayer.style.display = "none";
      if (!isCalibrationPointAAdded) {
        isMoving = true;
        const { newLine, firstDivider, lastDivider, lineLength } = addLine({
          points,
          isInitialShowText: false,
        });
        line = newLine;
        startDivider = firstDivider;
        endDivider = lastDivider;
        lineLengthText = lineLength;
        fabricCanvas.add(line, startDivider, endDivider, lineLengthText);
      } else if (isCalibrationPointAAdded && !isCalibrationPointBAdded) {
        moveLine({
          line,
          lineLengthText,
          pointer,
          points: [line.x1, line.y1, line.x2, line.y2],
        });
        completeLine({ line });
        fabricCanvas.renderAll();
      }
      return;
    }

    if (drawMode) {
      isDrawing = true;

      const { newLine, firstDivider, lastDivider, lineLength } = addLine({
        points,
      });

      line = newLine;
      startDivider = firstDivider;
      endDivider = lastDivider;
      lineLengthText = lineLength;
      fabricCanvas.add(line, startDivider, endDivider, lineLengthText);
    } else {
      if (moveMode) {
        isDragging = true;
      }
    }
  });

  // * Draw Line with shift key for straight line
  fabricCanvas.on("mouse:move", function (o) {
    if (isAnyLineSelected) return;
    if (calibrationMode) return;

    const evt = o.e;
    // * Draw Line
    if (drawMode && isDrawing) {
      isMoving = true;
      const pointer = fabricCanvas.getPointer(evt);
      moveLine({ line, lineLengthText, pointer, points });
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

    if (calibrationMode) {
      if (isCalibrationPointAAdded) {
        isCalibrationPointBAdded = true;
        isCalibrationLineDrawn = true;
        fabricCanvas.setActiveObject(line);
      }
      isCalibrationPointAAdded = true;

      return;
    }

    if (!drawMode) return;
    isDrawing = false;
    completeLine({ line });

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

  fabricCanvas.on("selection:created", function (e) {
    const selectedObject = e.selected[0];
    handleLineObjectSelection(selectedObject);
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

      // Right and wrong icon at side of calibrate line 
      if (isCalibrationLineDrawn && calibrationMode) {
        fabric.Object.prototype.controls.deleteControl = new fabric.Control({
          x: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? 0.5 : 0.5, // Horizontal or vertical adjustment
          y: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -0.5 : 0.5,
          offsetY: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -16 : 0,
          offsetX: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? 16 : 20,
          cursorStyle: "pointer",
          mouseUpHandler: deleteObject,
          render: renderdeleteIcon,
          cornerSize: 24,
        });
        fabric.Object.prototype.controls.doneControl = new fabric.Control({
          x: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? 0.5 : 0.5, // Horizontal or vertical adjustment
          y: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -0.5 : 0.5,
          offsetY: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -16 : -30,
          offsetX: Math.abs(x1 - x2) > Math.abs(y1 - y2) ? -16 : 20,
          cursorStyle: "pointer",
          mouseUpHandler: doneObject,
          render: renderDoneIcon,
          cornerSize: 24,
        });
      } else {
        if (selectedLine.controls.deleteControl)
          delete selectedLine.controls.deleteControl;
        if (selectedLine.controls.doneControl)
          delete selectedLine.controls.doneControl;
      }
      fabricCanvas.renderAll();
    }
  }

  function deleteObject() {
    if (confirm("Are you sure you want to delete this line?")) {
      removeLine(line);

      message.style.display = "none";
      document.getElementById("popup").style.display = "none";
      document.getElementById("calibration-btn").style.backgroundColor =
        "#EFEFEF";
    }
    resetCalibrationState();
  }

  function renderdeleteIcon(ctx, left, top, styleOverride, fabricObject) {
    const size = this.cornerSize;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(deleteImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function doneObject() {
    document.getElementById("popup").style.display = "flex";
    message.style.display = "none";
    const lengthText = updateMinions(line);
    document.getElementById("pdfLineLengthValue").innerHTML =
      lengthText.toFixed(2) + "px";
  }

  function renderDoneIcon(ctx, left, top, styleOverride, fabricObject) {
    const size = this.cornerSize;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(doneImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function convertRealLineLength(realLineValue, realLineValueUnit) {
    const inchesToPixels = 96;
    const mmToPixels = 1151.9999999832 / 304.8; // 1 mm = 1/25.4 inches, 1 inch = 96 pixels, hence 1 mm = (96 / 25.4) pixels
    const cmToPixels = 1151.9999999832 / 30.48; // 1 cm = 10 mm, hence conversion factor for cm
    const mToPixels = 1151.9999999832 / 0.3048; // 1 m = 1000 mm, hence conversion factor for m

    switch (realLineValueUnit) {
      case "ft":
        return realLineValue * 1151.9999999832;
      case "ftin":
        // Split the input string into feet and inches
        const [feet, inches] = realLineValue.split("-").map(Number);
        // Convert feet to inches and add the extra inches
        const totalInches = feet * 12 + inches;
        // Convert inches to pixels
        return totalInches * inchesToPixels;
      case "mm":
        return realLineValue * mmToPixels;
      case "cm":
        return realLineValue * cmToPixels;
      case "m":
        return realLineValue * mToPixels;
      default:
        return realLineValue;
    }
  }

  function countCalibrationPoint(pdfLineLengthValue, realLineLengthValue) {
    return (calibrationPoint = realLineLengthValue / pdfLineLengthValue);
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

  /**
   * Function to reset the calibration state.
   * Sets the move mode to true, calibration mode to false, and the flags for drawing calibration lines and points to false.
   * @returns {void}
   */
  function resetCalibrationState() {
    moveMode = true;
    calibrationMode = false;
    isCalibrationLineDrawn = false;
    isCalibrationPointAAdded = false;
    isCalibrationPointBAdded = false;
  }

  //* ---------> manage zoom on mouse and keyboard start ---------->

  // * Button event for draw line
  toggleDrawBtn.addEventListener("click", function () {
    drawMode = !drawMode;
    moveMode = !moveMode;
    this.textContent = drawMode ? "Measure on" : "Measure";

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
      const activeObject = fabricCanvas.getActiveObject();
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

  //* button event the set the calibration
  if (calibrationPoint === 1) {
    document
      .querySelector("#calibration-btn")
      .addEventListener("click", function () {
        clearCalibration();

        calibrationMode = true;
        moveMode = false;

        calibrationMode
          ? (this.style.backgroundColor = "green")
          : (this.style.backgroundColor = "#EFEFEF");

        let message = document.getElementById("message");
        message.style.display = "block"; // Show the message

        const backgroundLayer = document.querySelector("#background-layer");
        backgroundLayer.style.display = "block";
        backgroundLayer.style.backgroundColor = "#3f85ef61";

        fabricCanvas.forEachObject(function (obj) {
          obj.selectable = !drawMode;
        });
      });
  } else {
    alert("calibration point is already set");
  }

  //* Button event to set the calibration point
  document
    .querySelector("#setCalibration-value-btn")
    .addEventListener("click", function () {
      realLineValueUnit = document.getElementById("realLengthUnitSelect").value;

      if (realLineValueUnit === "ftin") {
        realLineValue = document.getElementById("realLineLengthValue").value;

        // match = /^(\d+)'\-(\d+(?:\.\d*)?)"$/.exec(realLineValue);
        match = /^(\d+)'\-(\d+)"$/.exec(realLineValue); // 10'-00"
        match1 = /^(\d+)'\-(\d+)''$/.exec(realLineValue); // 10'-00''
        match2 = /^(\d+)'(\d+)"$/.exec(realLineValue); // 10'00"
        match3 = /^(\d+)'(\d+)''$/.exec(realLineValue); // 10'00''
        if (match) {
          feet = parseInt(match[1], 10);
          inches = parseInt(match[2], 10);
          realLineValue = feet + "-" + inches;
        } else if (match1) {
          feet = parseInt(match1[1], 10);
          inches = parseInt(match1[2], 10);
          realLineValue = feet + "-" + inches;
        } else if(match2){
          feet = parseInt(match2[1], 10);
          inches = parseInt(match2[2], 10);
          realLineValue = feet + "-" + inches;
        } else if(match3){
          feet = parseInt(match3[1], 10);
          inches = parseInt(match3[2], 10);
          realLineValue = feet + "-" + inches;
        }else {
          alert("Value must be in the format 00'-00\" or 00'00\" ");
          return;
        }
      } else {
        realLineValue = document.getElementById("realLineLengthValue").value;
      }

      const realLineLengthValue = convertRealLineLength(
        realLineValue,
        realLineValueUnit
      );
      const pdfLineLengthValue = updateMinions(line);

      countCalibrationPoint(pdfLineLengthValue, realLineLengthValue);

      document.getElementById("popup").style.display = "none";
      document.getElementById("calibration-btn").style.backgroundColor =
        "#EFEFEF";

      resetCalibrationState();
      removeLine(line);
      fabricCanvas.discardActiveObject(line);
    });

  //* Button event the close the popup box
  document
    .querySelector("#popup-close-btn")
    .addEventListener("click", function () {
      resetCalibrationState();

      document.getElementById("popup").style.display = "none";
      document.getElementById("calibration-btn").style.backgroundColor =
        "#EFEFEF";
      removeLine(line);
    });

  function clearCalibration() {
    isCalibrationLineDrawn = false;
    isCalibrationPointAAdded = false;
    isCalibrationPointBAdded = false;
    calibrationPoint = 1;
    realLineValue = 0;
    pdfLineValue = 0;
    realLineValueUnit = "";
  }

  // message check button functionaity to close message box
  document
    .querySelector("#messagecheck")
    .addEventListener("click", function (e) {
      message = document.getElementById("message");
      message.style.display = "none";
    });
};

/**
 * Function to update the text representing the length of a line.
 * @param {Object} line - The line for which the length text is being updated.
 * @param {Object} text - The text object representing the length of the line.
 * @returns {void}
 */
function updateLineLengthText(line, text) {
  // Calculate the length of the line
  const length = calculateLineLength(line);

  // Calculate the center coordinates of the line
  const centerX = (line.x1 + line.x2) / 2;
  const centerY = (line.y1 + line.y2) / 2;

  // Set the text of the length text object
  // Convert the length to the appropriate unit and format
  text.set({
    left: centerX,
    top: centerY,
    text: `${convertPixelLength(
      length,
      realLineValueUnit === "" ? "px" : realLineValueUnit
    )}`,
  });
}

/**
 * Function to add a new line to the canvas.
 * @param {Object} options - The options for creating the line.
 * @returns {Object} - The new line, its start divider, end divider, and line length text.
 */
const addLine = ({ points, isInitialShowText }) => {
  // const pointer = fabricCanvas.getPointer(evt);
  let newLine = new fabric.Line(points, {
    strokeWidth: 0.3,
    fill: "black",
    stroke: "black",
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    lockSkewingX: true,
    lockSkewingY: true,
    // id: groupLength,
    // name: `group-${groupLength}-line`,
  });

  const startDivider = makeDivider(
    newLine.get("x1"),
    newLine.get("y1"),
    newLine
  );
  const endDivider = makeDivider(newLine.get("x2"), newLine.get("y2"), newLine);

  let lineLengthText = makeLineLengthText(newLine);

  newLine.minions = [startDivider, endDivider, lineLengthText];

  return {
    newLine,
    firstDivider: startDivider,
    lastDivider: endDivider,
    lineLength: lineLengthText,
  };
};

/**
 * Function to handle the mouse move event while drawing a line.
 * @param {Object} options - The options for moving the line.
 * @param {Object} options.line - The line being moved.
 * @param {Object} options.pointer - The current pointer position.
 * @param {Array} options.points - The initial points of the line.
 * @param {Object} options.lineLengthText - The text object representing the length of the line.
 * @returns {void}
 */
const moveLine = ({ line, pointer, points, lineLengthText }) => {
  const dx = Math.abs(pointer.x - points[0]);
  const dy = Math.abs(pointer.y - points[1]);
  const [startDivider, endDivider] = line.minions;

  // Determine the direction of the line based on the movement of the mouse
  if (dx > dy) {
    points[2] = pointer.x;
    points[3] = points[1];
  } else {
    points[2] = points[0];
    points[3] = pointer.y;
  }

  // Update the line's coordinates
  line.set({
    x2: points[2],
    y2: points[3],
  });

  // Update the text representing the length of the line
  updateLineLengthText(line, lineLengthText);

  // Update the position and angle of the end divider
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

  // Update the position and angle of the start divider
  startDivider.set({
    angle: calculatePerpendicularAngle(
      points[0],
      points[1],
      points[2],
      points[3]
    ),
  });
};

/**
 * Function to handle the completion of drawing a line.
 * Sets the line as selectable and evented, and updates the position and angle of the dividers.
 * @param {Object} options - The options for completing the line.
 * @param {Object} options.line - The line being completed.
 * @returns {void}
 */
const completeLine = ({ line }) => {
  const [startDivider, endDivider] = line.minions;

  // Set the line as selectable and evented
  line.setCoords();
  line.set({
    selectable: true,
    evented: true,
  });

  // Update the position of the start divider
  startDivider.setCoords();
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

  // Update the position of the end divider
  endDivider.setCoords();
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

  // Set the relationship between the line and its minions
  setRelationship(line);
};

/**
 * Function to remove a line from the canvas.
 * Removes the line and its associated minions (dividers and text) from the canvas.
 * @param {Object} line - The line to be removed.
 * @returns {void}
 */
function removeLine(line) {
  // Iterate over the minions (dividers and text) of the line
  line.minions.forEach((minion) => {
    // Remove each minion from the canvas
    fabricCanvas.remove(minion);
  });

  // Remove the line from the canvas
  fabricCanvas.remove(line);

  // Render the canvas to update the changes
  fabricCanvas.renderAll();
}

/**
 * Function to create a divider (rectangle) for a line.
 * @param {number} left - The x-coordinate of the divider's position.
 * @param {number} top - The y-coordinate of the divider's position.
 * @param {Object} line - The line to which the divider is associated.
 * @returns {Object} - The created divider.
 */
function makeDivider(left, top, line) {
  const divider = new fabric.Rect({
    left: left,
    top: top,
    width: 15,
    height: 0.5,
    fill: "#666",
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    // id: groupLength,
    // name: `group-${groupLength}-divider`,
  });
  divider.hasControls = divider.hasBorders = false;
  divider.line = line;
  return divider;
}

/**
 * Function to create a text object representing the length of a line.
 * @param {Object} line - The line for which the length text is being created.
 * @returns {Object} - The created text object representing the length of the line.
 */
function makeLineLengthText(line) {
  const text = new fabric.Text("", {
    fontSize: 6,
    height: 10,
    fontFamily: "Candara Light",
    fontWeight: 1000,
    fill: "#000",
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    backgroundColor: "white",
    // id: groupLength,
    // name: `group-${groupLength}-text`,
  });

  // Update the text with the current length of the line
  updateLineLengthText(line, text);

  return text;
}

/**
 * Function to calculate the length of a line.
 * @param {Object} line - The line for which the length is being calculated.
 * @returns {number} - The length of the line, taking into account the calibration point.
 */
function calculateLineLength(line) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  return Math.sqrt(dx * dx + dy * dy) * calibrationPoint;
}

/**
 * Function to convert pixel length to the specified unit.
 * @param {number} pixelValue - The length in pixels.
 * @param {string} realLineValueUnit - The unit to convert to.
 * @returns {string|number} - The length in the specified unit, rounded to two decimal places.
 * If the unit is 'ftin', returns the length in feet and inches.
 */
function convertPixelLength(pixelValue, realLineValueUnit) {
  const pixelsToInches = 1 / 96;
  const pixelsToMm = 304.8 / 1151.9999999832; // 1 pixel = (25.4 / 96) mm
  const pixelsToCm = 30.48 / 1151.9999999832; // 1 pixel = (2.54 / 96) cm
  const pixelsToM = 0.3048 / 1151.9999999832; // 1 pixel = (0.0254 / 96) m
  const pixelsToFt = 1 / 1151.9999999832; // 1 pixel = (1 / 1151.9999999832) ft

  let result = pixelValue;
  switch (realLineValueUnit) {
    case "ft":
      result = pixelValue * pixelsToFt;
      break;
    case "ftin":
      const precisionvalue = document.getElementById("pre").value;
      const totalInches = pixelValue * pixelsToInches;
      const feet = Math.floor(totalInches / 12);
      const inches = totalInches % 12;
      const preciosion = inches - Math.floor(inches);
      const quarter = precisionvalue.split("/")[1];
      const fraction = getFraction(preciosion, quarter);
      fraction === ` ${quarter} / ${quarter}`;

      //console.log(quarter);
      const ans = preciosion <= 0.1 ? " " : fraction;
      //console.log(ans);
      result = `${feet}'-${inches.toFixed(0)} ${ans}"`;
      break;
    case "mm":
      result = pixelValue * pixelsToMm;
      break;
    case "cm":
      result = pixelValue * pixelsToCm;
      break;
    case "m":
      result = pixelValue * pixelsToM;
      break;
    default:
      result = pixelValue;
      break;
  }
  if (realLineValueUnit === "ftin") {
    return result;
  } else {
    return result.toFixed(2);
  }
}
/**
 * Function to get the fraction part of a decimal number.
 * @param {number} value - The decimal number.
 * @param {number} quarters - The number of quarters to divide the decimal number into.
 * @returns {string} - The fraction part of the decimal number in the format of "numerator/denominator".
 */
function getFraction(value, quarters) {
  // Ensure the value is between 0 and 1
  if (value < 0 || value > 1) {
    throw new Error("Value should be between 0 and 1");
  }

  // Calculate the size of each quarter
  const quarterSize = 1 / quarters;

  let quartersIndex = -1;

  // Determine the quarter index
  for (let i = 1; i <= quarters; i++) {
    if (value <= i * quarterSize) {
      quartersIndex = i;
      break;
    }
  }
  //console.log(value);
  return `${quartersIndex}/${quarters}`;  
}

/**
 * Function to calculate the angle of a perpendicular line to the given line segment.
 * The angle is calculated in degrees, with 0 degrees pointing to the right.
 * @param {number} x1 - The x-coordinate of the start point of the line segment.
 * @param {number} y1 - The y-coordinate of the start point of the line segment.
 * @param {number} x2 - The x-coordinate of the end point of the line segment.
 * @param {number} y2 - The y-coordinate of the end point of the line segment.
 * @returns {number} - The angle of the perpendicular line in degrees.
 */
function calculatePerpendicularAngle(x1, y1, x2, y2) {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;
}

/**
 * Function to update the minions (dividers and text) of a line.
 * @param {Object} line - The line for which the minions are being updated.
 * @returns {number} - The length of the line after updating the minions.
 */
function updateMinions(line) {
  // Check if the line has minions
  if (!line.minions) return;

  // Calculate the transformed coordinates of the start and end points of the line
  const points = line.calcLinePoints();
  const startPoint = new fabric.Point(points.x1, points.y1);
  const endPoint = new fabric.Point(points.x2, points.y2);
  const transformMatrix = line.calcTransformMatrix();
  const startTransformed = fabric.util.transformPoint(
    startPoint,
    transformMatrix
  );
  const endTransformed = fabric.util.transformPoint(endPoint, transformMatrix);

  // Calculate the angle of the perpendicular line to the line segment
  const angle = calculatePerpendicularAngle(
    startTransformed.x,
    startTransformed.y,
    endTransformed.x,
    endTransformed.y
  );

  // Update the position and angle of the start divider
  line.minions[0]
    .set({ left: startTransformed.x, top: startTransformed.y, angle: angle })
    .setCoords();

  // Update the position and angle of the end divider
  line.minions[1]
    .set({ left: endTransformed.x, top: endTransformed.y, angle: angle })
    .setCoords();

  // Calculate the length of the line
  const length =
    Math.sqrt(
      Math.pow(endTransformed.x - startTransformed.x, 2) +
        Math.pow(endTransformed.y - startTransformed.y, 2)
    ) * calibrationPoint;

  // Update the text representing the length of the line
  line.minions[2]
    .set({
      text: `${convertPixelLength(
        length,
        realLineValueUnit === "" ? "px" : realLineValueUnit
      )}`,
      left: (startTransformed.x + endTransformed.x) / 2,
      top: (startTransformed.y + endTransformed.y) / 2,
    })
    .setCoords();

  // Return the length of the line
  return length;
}

/**
 * Function to set the relationship between a line and its minions (dividers and text).
 * The relationship is stored as a transform matrix that can be used to position the minions relative to the line.
 * @param {Object} line - The line for which the relationship is being set.
 * @returns {void}
 */
function setRelationship(line) {
  // Calculate the transform matrix of the line
  const bossTransform = line.calcTransformMatrix();

  // Invert the transform matrix of the line
  const invertedBossTransform = fabric.util.invertTransform(bossTransform);

  // Iterate over the minions (dividers and text) of the line
  line.minions.forEach((o) => {
    // Calculate the desired transform matrix by multiplying the inverted transform matrix of the line
    // with the transform matrix of the minion
    const desiredTransform = fabric.util.multiplyTransformMatrices(
      invertedBossTransform,
      o.calcTransformMatrix()
    );

    // Store the desired transform matrix as a relationship property of the minion
    o.relationship = desiredTransform;
  });
}

document.getElementById("realLengthUnitSelect").addEventListener(
  "change",
  /**
   * Event handler for the change event of the real line length unit select element.
   * Updates the value of the real line length value input element based on the selected unit.
   * @returns {void}
   */ function () {
    // Get the real line length value input element
    var realLineLengthValue = document.getElementById("realLineLengthValue");

    // Check the selected value of the real line length unit select element
    if (this.value === "ftin") {
      // If the selected unit is 'ftin', set the initial value of the real line length value input element to "00'-00\""
      realLineLengthValue.value = "00'-00\"";
    } else {
      // If the selected unit is not 'ftin', set the initial value of the real line length value input element to "00.00"
      realLineLengthValue.value = "00.00";
    }
  }
);
