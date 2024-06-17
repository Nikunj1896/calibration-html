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

const zoomCanvas = document.getElementById('zoomed');
const zoomctx = zoomCanvas.getContext('2d');

let totalPage = 0;
let currentPage = 1;
let currentPdfFile = null;
let realLineValueUnit = "";
let calibrationPoint = 1;
let fabricCanvas;
let isMegnifier = false;
let zoom = 1;
let lineColor = "black";

let calibrationMode = false; // Flag to indicate whether the canvas is in calibration mode
let isCalibrationPointAAdded = false;
let isCalibrationPointBAdded = false;
let isCalibrationLineDrawn = false; // Flag to indicate whether the calibration line  has drawn or not

fabric.Object.prototype.padding = 10;
fabric.Object.prototype.transparentCorners = false;
fabric.Object.prototype.cornerStyle = "circle";

document.querySelector("#pdf-upload").addEventListener(
    "change",
    /**
 * Event listener for file upload.
 * Validates the uploaded file to ensure it's a PDF.
 * If valid, sets the current PDF file and renders the first page to the canvas.
 *
 * @param {Event} e - The event object containing the file upload details.
 */
    /**
 * Event listener for file input.
 * Validates the selected file to ensure it's a PDF.
 * If valid, sets the current PDF file and renders the first page to the canvas.
 * @param {Event} e - The event object containing the file input details.
 */
function (e) {
    const file = e.target.files[0];
    if (file.type !== "application/pdf") {
        console.error(file.name, "is not a pdf file.");
        return;
    }
    currentPdfFile = file;
    currentPage = 1;
    renderPdfToCanvas(file, currentPage);
}
);

document.querySelector("#megnifier").addEventListener("click", /**
 * Toggles the magnifier functionality.
 * 
 * @param {Event} event - The event that triggered this function.
 * @returns {void}
 */
    /**
 * Toggles the magnifier mode on and off.
 * @returns {void}
 */
function () {
    isMegnifier = !isMegnifier;
    console.log('ismegnifier', isMegnifier);

    if (isMegnifier) {
        this.style.backgroundColor = 'red';
        zoomCanvas.style.display = 'block';
    } else {
        this.style.backgroundColor = '#EFEFEF';
        zoomCanvas.style.display = 'none';
    }
});

document.querySelector("#color").addEventListener("change", /**
 * Event listener for changing the line color.
 * Updates the line color and logs the selected color to the console.
 * @param {Event} e - The event object that triggered this function.
 */
function (e) {
    lineColor = e.target.value;
    console.log("lineColor: " + lineColor);
})

const drawCross = (context, width, height) => {
    context.strokeStyle = 'aqua';
    context.lineWidth = 1;

    // Set the line dash pattern for a dashed line
    context.setLineDash([5, 3]); // 5 pixels drawn, 3 pixels blank

    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();

    // Reset the line dash to default (solid line) if needed
    context.setLineDash([]);
};

const renderPdfToCanvas = (pdfFile, pageNumber) => {
    const fileReader = new FileReader();
    fileReader.onload = function () {
        const typedarray = new Uint8Array(this.result);

        PDFJS.getDocument(typedarray).then(function (pdf) {
            totalPage = pdf.numPages;
            updateButtonStates();

            pdf.getPage(pageNumber).then(function (page) {
                const viewport = page.getViewport(3.0);
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

                return { page, viewport };
            });
        });
    };
    fileReader.readAsArrayBuffer(pdfFile);
};

previous.addEventListener("click", /**
 * Function to handle the previous page button click event.
 * Decrements the currentPage variable and re-renders the PDF on the canvas.
 *
 * @returns {void}
 */
    /**
 * Function to handle the previous page button click event.
 * Decrements the currentPage variable and re-renders the PDF on the canvas.
 *
 * @returns {void}
 */
function () {
    currentPage = currentPage - 1; // Decrement the currentPage
    initFabricCanvas(); // Initialize the fabric canvas
    renderPdfToCanvas(currentPdfFile, currentPage); // Render the PDF on the canvas
});

next.addEventListener("click", /**
 * Function to handle the next page button click event.
 * Increases the currentPage variable by 1 and re-renders the PDF on the canvas.
 *
 * @returns {void}
 */
    /**
 * Function to handle the next page button click event.
 * Increases the currentPage value by 1 and re-renders the PDF on the canvas.
 *
 * @returns {void}
 */
function () {
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

    let realLineValue = 0;

    const bg = canvasEl.toDataURL("image/png");
    fabricCanvas = new fabric.Canvas("pdfcanvas");
    fabricCanvas.selection = false;

    // * Print PDF into canvas as Image
    fabric.Image.fromURL(bg, function (img) {
        img.scaleToHeight(1123);
        fabricCanvas.setHeight(1123); // customize canvasE1.width
        fabricCanvas.setWidth(1588); // customize canvasE1.height
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
    fabricCanvas.on("mouse:move", function (o, e) {
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

        // * Magnifier
        updateMagnifier(o)
    });

    fabricCanvas.on('mouse:out', () => {
        if (isMegnifier) {
            console.log('mouseLeave ------------------------------');
            zoomCanvas.style.display = 'none';
        }
    });

    fabricCanvas.on('mouse:over', () => {
        if (isMegnifier) {
            console.log('Mouse entered the canvas');
            zoomCanvas.style.display = 'block';
        }
    });

    function updateMagnifier(o) {
        if (!isMegnifier) return

        console.log("o", o);
        const evt = o.e;
        console.log("evt", evt);
        const mLevel = 2; // Magnification level
        const pointer = fabricCanvas.getPointer(evt);
        const { width, height } = zoomCanvas;
        const [left, top] = fabricCanvas.viewportTransform.slice(4, 6);

        // Calculate zoomed area
        const sx = (pointer.x * zoom) - (width / (2 * mLevel)) / zoom + 30;
        const sy = (pointer.y * zoom) - (height / (2 * mLevel)) / zoom + 30;
        const sw = width / (mLevel * zoom);
        const sh = height / (mLevel * zoom);

        // Update the position of zoomCanvas based on the cursor position
        zoomCanvas.style.left = `${evt.clientX}px`;
        zoomCanvas.style.top = `${evt.clientY}px`;

        try {
            zoomctx.clearRect(0, 0, width, height);
            zoomctx.imageSmoothingEnabled = true;
            zoomctx.drawImage(
                fabricCanvas.lowerCanvasEl,
                sx + left, sy + top, sw, sh, // Source rectangle
                0, 0, width, height // Destination rectangle
            );
            drawCross(zoomctx, width, height); // Draw crosshair or any other overlay
        } catch (error) {
            console.log("Error drawing zoom:", error);
        }
    }

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
        updateMagnifier(o)
    });

    fabricCanvas.on("object:rotating", function (o) {
        updateMinions(o.target);
        updateMagnifier(o)
    });

    fabricCanvas.on("object:scaling", function (o) {
        updateMinions(o.target);
        updateMagnifier(o)
    });

    function handleLineObjectSelection(selectedLine) {
        isAnyLineSelected = true;

        if (selectedLine && selectedLine.type === "line") {
            const { x1, y1, x2, y2 } = selectedLine;
            if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
                //* Horizontal line
                selectedLine.setControlsVisibility({
                    ml: true, //middle-left
                    //bottom-left
                    br: false, //bottom-right
                    mt: false, //middle-top
                    mb: false, //middle-bottom
                    mtr: true, //rotation-pointer
                    mr: true, //middle-right
                    tl: false, //top-left
                    tr: false, //top-right
                    bl: false,
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
                    mtr: true, // rotate control
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

    function handleZoom(event, type) {
        event.preventDefault();
        let zoomFactor = 0.2;
        zoom = fabricCanvas.getZoom();
        console.log("zoom factor :", zoom);
        type === "in" && (zoom += zoomFactor);
        type === "out" && (zoom -= zoomFactor);
        zoom = Math.min(Math.max(zoom, 1), 8);
        fabricCanvas.zoomToPoint({ x: event.offsetX, y: event.offsetY }, zoom);
        // fabricCanvas.setZoom(zoom);
        fabricCanvas.renderAll();
    }

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
        } else if (event.key === "Delete") {
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
                const delta = Math.sign(event.deltaY) * 30;
                fabricCanvas.relativePan(new fabric.Point(delta, 0));
            } else {
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
                } else if (match2) {
                    feet = parseInt(match2[1], 10);
                    inches = parseInt(match2[2], 10);
                    realLineValue = feet + "-" + inches;
                } else if (match3) {
                    feet = parseInt(match3[1], 10);
                    inches = parseInt(match3[2], 10);
                    realLineValue = feet + "-" + inches;
                } else {
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

    document
        .querySelector("#messagecheck")
        .addEventListener("click", function (e) {
            message = document.getElementById("message");
            message.style.display = "none";
        });
};

const displayFileName = () => {
    var input = document.getElementById("pdf-upload");
    var fileName = input.files[0].name;
    console.log(fileName);
    document.getElementById("file-value").innerHTML = fileName;
    document.getElementById("file-value").style.display = "block";
};

/**
 * Updates the text of the line length on the canvas.
 *
 * @param {fabric.Line} line - The line object to update the text for.
 * @param {fabric.Text} text - The text object to update with the line length.
 *
 * @returns {undefined}
 */
function updateLineLengthText(line, text) {
    const length = calculateLineLength(line);

    const centerX = (line.x1 + line.x2) / 2;
    const centerY = (line.y1 + line.y2) / 2;
    text.set({
        left: centerX,
        top: centerY,
        text: `${convertPixelLength(
            length,
            realLineValueUnit === "" ? "px" : realLineValueUnit
        )}`,
    });
}
const addLine = ({ points, isInitialShowText }) => {
    let newLine = new fabric.Line(points, {
        strokeWidth: 0.3,
        fill: calibrationMode ? "black" : lineColor,
        stroke: calibrationMode ? "black" : lineColor,
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        lockSkewingX: true,
        lockSkewingY: true,
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

const moveLine = ({ line, pointer, points, lineLengthText }) => {
    const dx = Math.abs(pointer.x - points[0]);
    const dy = Math.abs(pointer.y - points[1]);
    const [startDivider, endDivider] = line.minions;
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
};

const completeLine = ({ line }) => {
    const [startDivider, endDivider] = line.minions;
    line.setCoords();
    line.set({
        selectable: true,
        evented: true,
    });
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
    setRelationship(line);
};

/**
 * Removes a line from the canvas and its associated minions (dividers and text).
 *
 * @param {fabric.Line} line - The line object to remove.
 *
 * @returns {undefined}
 */
function removeLine(line) {
    // Iterate through the minions (dividers and text) associated with the line
    line.minions.forEach((minion) => {
        // Remove each minion from the canvas
        fabricCanvas.remove(minion);
    });

    // Remove the line from the canvas
    fabricCanvas.remove(line);

    // Render the canvas to reflect the changes
    fabricCanvas.renderAll();
}

/**
 * Creates a divider object for the line.
 *
 * @param {number} left - The x-coordinate of the divider.
 * @param {number} top - The y-coordinate of the divider.
 * @param {fabric.Line} line - The line object to associate with the divider.
 *
 * @returns {fabric.Rect} - The divider object.
 */
/**
 * Creates a divider object for the line.
 *
 * @param {number} left - The x-coordinate of the divider.
 * @param {number} top - The y-coordinate of the divider.
 * @param {fabric.Line} line - The line object to associate with the divider.
 *
 * @returns {fabric.Rect} - The divider object.
 */
function makeDivider(left, top, line) {
    const divider = new fabric.Rect({
        strokeWidth: 0.1,
        stroke: calibrationMode ? "black" : lineColor,
        left: left,
        top: top,
        width: 10,
        height: 0.5,
        fill: "#666",
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
    });
    divider.hasControls = divider.hasBorders = false;
    divider.line = line;
    return divider;
}

/**
 * Creates a text object for the line length on the canvas.
 *
 * @param {fabric.Line} line - The line object to associate with the text.
 *
 * @returns {fabric.Text} - The text object for the line length.
 */
/**
 * Creates a text object for the line length on the canvas.
 *
 * @param {fabric.Line} line - The line object to associate with the text.
 *
 * @returns {fabric.Text} - The text object for the line length.
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
    });

    // Update the text with the line length
    updateLineLengthText(line, text);

    return text;
}

/**
 * Calculates the length of a line in pixels, taking into account the calibration point.
 *
 * @param {fabric.Line} line - The line object for which to calculate the length.
 *
 * @returns {number} - The length of the line in pixels, adjusted for the calibration point.
 */
/**
 * Calculates the length of a line in pixels, taking into account the calibration point.
 *
 * @param {fabric.Line} line - The line object for which to calculate the length.
 *
 * @returns {number} - The length of the line in pixels, adjusted for the calibration point.
 */
function calculateLineLength(line) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    return Math.sqrt(dx * dx + dy * dy) * calibrationPoint;
}

/**
 * Converts a pixel length to the specified real-world unit, taking into account the calibration point.
 *
 * @param {number} pixelValue - The length in pixels.
 * @param {string} realLineValueUnit - The real-world unit to convert to.
 *
 * @returns {string|number} - The length in the specified real-world unit, adjusted for the calibration point.
 * If the unit is 'ftin', it returns a string in the format '00'-00"'.
 * Otherwise, it returns a number rounded to two decimal places.
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
            const quarter = precisionvalue.split("/")[1];    // 2,4,8,16,32
            const fraction = getFraction(preciosion, quarter);
            fraction === ` ${quarter} / ${quarter}`;
            const ans = preciosion <= 0.1 ? " " : fraction;
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
 * Calculates the fraction of a value based on the number of quarters.
 *
 * @param {number} value - The value to calculate the fraction for.
 * @param {number} quarters - The number of quarters to divide the value into.
 *
 * @throws {Error} - If the value is not between 0 and 1.
 *
 * @returns {string} - The fraction as a string in the format "x/y".
 */
function getFraction(value, quarters) {
    // Ensure the value is between 0 and 1
    if (value < 0 || value > 1) {
        throw new Error("Value should be between 0 and 1");
    }
    const quarterSize = 1 / quarters;
    let quartersIndex = -1;
    for (let i = 1; i <= quarters; i++) {
        if (value <= i * quarterSize) {
            quartersIndex = i;
            break;
        }
    }
    return `${quartersIndex}/${quarters}`;
}

/**
 * Calculates the angle of a perpendicular line to the given line segment.
 *
 * @param {number} x1 - The x-coordinate of the start point of the line segment.
 * @param {number} y1 - The y-coordinate of the start point of the line segment.
 * @param {number} x2 - The x-coordinate of the end point of the line segment.
 * @param {number} y2 - The y-coordinate of the end point of the line segment.
 *
 * @returns {number} - The angle of the perpendicular line in degrees, with 0 degrees pointing to the right.
 */
function calculatePerpendicularAngle(x1, y1, x2, y2) {
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;
}

/**
 * Updates the minions (dividers and text) associated with a line.
 *
 * @param {fabric.Line} line - The line object to update the minions for.
 *
 * @returns {number} - The length of the line in pixels, adjusted for the calibration point.
 */
function updateMinions(line) {
    // Check if the line has minions associated with it
    if (!line.minions) return;

    // Calculate the transformed coordinates of the line's start and end points
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

    // Calculate the length of the line in pixels, adjusted for the calibration point
    const length =
        Math.sqrt(
            Math.pow(endTransformed.x - startTransformed.x, 2) +
            Math.pow(endTransformed.y - startTransformed.y, 2)
        ) * calibrationPoint;

    // Update the text of the line length
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

    // Return the length of the line in pixels, adjusted for the calibration point
    return length;
}

/**
 * Sets the relationship between a line and its minions (dividers and text) by calculating and storing the desired transform matrix.
 *
 * @param {fabric.Line} line - The line object to set the relationship for.
 *
 * @returns {undefined}
 */
function setRelationship(line) {
    // Calculate the transform matrix of the line
    const bossTransform = line.calcTransformMatrix();

    // Invert the transform matrix of the line
    const invertedBossTransform = fabric.util.invertTransform(bossTransform);

    // Iterate through the minions (dividers and text) associated with the line
    line.minions.forEach((o) => {
        // Calculate the desired transform matrix by multiplying the inverted transform matrix of the line with the transform matrix of the minion
        const desiredTransform = fabric.util.multiplyTransformMatrices(
            invertedBossTransform,
            o.calcTransformMatrix()
        );

        // Store the desired transform matrix as a property of the minion
        o.relationship = desiredTransform;
    });
}

document.getElementById("realLengthUnitSelect").addEventListener("change", () => {
    /**
     * Event handler for the real line length unit select element.
     * Updates the value of the real line length input field based on the selected unit.
     *
     * @returns {undefined}
     */
    const realLineLengthValue = document.getElementById("realLineLengthValue");
    const { value } = event.target;

    if (value === "ftin") {
        realLineLengthValue.value = "00'-00\"";
    } else {
        realLineLengthValue.value = "00.00";
    }
});