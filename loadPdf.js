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
  let points;
  let isDragging = false;
  let isAnyLineSelected = false;
  let lastPosX, lastPosY;
  let lines = [];
  let lengthText;
  const lineStack = []; // Stack to keep track of drawn lines
  const redoStack = []; // Stack to keep track of undone lines
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
      // Initialize the length text
      lengthText = new fabric.Text("", {
        left: pointer.x,
        top: pointer.y - 10, // Position slightly above the cursor
        fill: "black",
        fontSize: 16,
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        backgroundColor: "white",
        padding: 10,
      });
      fabricCanvas.add(lengthText);
    } else {
      if (moveMode) {
        isDragging = true;
        fabricCanvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    }
  });

  // Function to calculate length in feet and inches
  function calculateLengthInFeetAndInches(line) {
    const dx = line.x2 - line.x1; // pixels value
    const dy = line.y2 - line.y1;

    const lengthInPixels = Math.sqrt(dx * dx + dy * dy);
    const lengthInInches = lengthInPixels * 0.0104167;
    const lengthInFeet = lengthInInches;
    const feet = Math.floor(lengthInFeet);
    const remainingInches = (lengthInFeet - feet) * 12;
    const inchesRoundOf = Math.round(remainingInches);
    const inches =
      inchesRoundOf < 10 ? "0" + inchesRoundOf : "" + inchesRoundOf;
    return feet + ` ' - ` + inches + ` " `;
  }

  // *  Draw Line with shift key for straight line
  fabricCanvas.on("mouse:move", function (o) {
    if (isAnyLineSelected) return;
    const evt = o.e;
    if (drawMode && isDrawing) {
      const pointer = fabricCanvas.getPointer(evt);
      const deltaX = Math.abs(pointer.x - points[0]);
      const deltaY = Math.abs(pointer.y - points[1]);

      if (deltaX > deltaY) {
        // Draw horizontal line
        points[2] = pointer.x;
        points[3] = points[1];
      } else {
        // Draw vertical line
        points[2] = points[0];
        points[3] = pointer.y;
      }

      line.set({
        x2: points[2],
        y2: points[3],
      });
      const length = calculateLengthInFeetAndInches(line);
      lengthText.set({
        left: points[2],
        top: points[3] - 20,
        text: length,
      });
      fabricCanvas.renderAll();
    }
    if (isDragging) {
      const dx = evt.movementX;
      const dy = evt.movementY;
      fabricCanvas.relativePan(new fabric.Point(dx, dy));
      fabricCanvas.renderAll();
    }
  });

  // * Draw line mouse up Event
  fabricCanvas.on("mouse:up", function (o) {
    if (isAnyLineSelected) return;
    isDragging = false;
    if (!drawMode) return;
    const lineData = {};
    isDrawing = false;
    line.setCoords();
    const length = calculateLengthInFeetAndInches(line);
    line.set("length", length);
    const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
    const smallLineLength = 30;
    const startLineX1 =
      line.x1 + (smallLineLength / 2) * Math.cos(angle + Math.PI / 2);
    const startLineY1 =
      line.y1 + (smallLineLength / 2) * Math.sin(angle + Math.PI / 2);
    const startLineX2 =
      line.x1 - (smallLineLength / 2) * Math.cos(angle + Math.PI / 2);
    const startLineY2 =
      line.y1 - (smallLineLength / 2) * Math.sin(angle + Math.PI / 2);
    const endLineX1 =
      line.x2 + (smallLineLength / 2) * Math.cos(angle + Math.PI / 2);
    const endLineY1 =
      line.y2 + (smallLineLength / 2) * Math.sin(angle + Math.PI / 2);
    const endLineX2 =
      line.x2 - (smallLineLength / 2) * Math.cos(angle + Math.PI / 2);
    const endLineY2 =
      line.y2 - (smallLineLength / 2) * Math.sin(angle + Math.PI / 2);
    const startLine = new fabric.Line(
      [startLineX1, startLineY1, startLineX2, startLineY2],
      {
        strokeWidth: 2,
        fill: "black",
        stroke: "black",
        selectable: false,
        evented: false,
      }
    );
    const endLine = new fabric.Line(
      [endLineX1, endLineY1, endLineX2, endLineY2],
      {
        strokeWidth: 2,
        fill: "black",
        stroke: "black",
        selectable: false,
        evented: false,
      }
    );
    lengthText.set({
      left: (line.x1 + line.x2) / 2,
      top: (line.y1 + line.y2) / 2,
      backgroundColor: "white",
      padding: 5,
    });
    const group = new fabric.Group([line, startLine, endLine, lengthText], {
      selectable: true,
      hasControls: true,
    });
    fabricCanvas.add(group);
    fabricCanvas.remove(line, lengthText);
    fabricCanvas.renderAll();
    lineData.group = group;
    lineData.line = line;
    lineData.length = length;
    lineData.lengthText = lengthText;
    lineData.startLine = startLine;
    lineData.endLine = endLine;
    lines.push(lineData);
    lineStack.push(group); // Add the group to the stack
    redoStack.length = 0; // Clear the redo stack whenever a new line is drawn
    fabricCanvas.renderAll();
  });

  fabricCanvas.on("object:selected", function (e) {
    isAnyLineSelected = true;
    const activeObject = e.target;
    if (activeObject && activeObject.type === "group") {
      activeObject.set({
        borderColor: "black",
        cornerColor: "yellow",
        cornerSize: 8,
        transparentCorners: false,
      });
      fabricCanvas.renderAll();
    }
  });

  fabricCanvas.on("selection:cleared", function (e) {
    isAnyLineSelected = false;
  });

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
      var activeObject = fabricCanvas.getActiveObject();
      if (activeObject && activeObject.type === "group") {
        fabricCanvas.remove(activeObject);
        fabricCanvas.renderAll();
      }
      // ctrl +z functionality for undo
    } else if (event.ctrlKey && event.key === "z") {
      // Undo the latest drawn line
      if (lineStack.length > 0) {
        const lastLine = lineStack.pop();
        redoStack.push(lastLine); // Add the removed line to the redo stack
        fabricCanvas.remove(lastLine);
        fabricCanvas.renderAll();
      }
      // ctrl + y functionality for redo
    } else if (event.ctrlKey && event.key === "y") {
      // Redo the latest undone line
      if (redoStack.length > 0) {
        const lastUndoneLine = redoStack.pop();
        lineStack.push(lastUndoneLine); // Add the line back to the line stack
        fabricCanvas.add(lastUndoneLine);
        fabricCanvas.renderAll();
      }
    }
  });

  document.addEventListener(
    "wheel",
    function (event) {
      if (event.deltaY < 0 && event.ctrlKey) {
        handleZoom(event, "in");
      } else if (event.deltaY > 0 && event.ctrlKey) {
        handleZoom(event, "out");
      }
    },
    { passive: false }
  );

  document
    .querySelector("#zoom-in")
    .addEventListener("click", (event) => handleZoom(event, "in"));

  document
    .querySelector("#zoom-out")
    .addEventListener("click", (event) => handleZoom(event, "out"));
};
