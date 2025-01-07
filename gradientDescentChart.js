import {
    SciChart3DSurface,
    NumericAxis3D,
    Vector3,
    SciChartJsNavyTheme,
    NumberRange,
    ArrowAnnotation3D,
    LineAnnotation3D,
    EAxisAlignment,
    EAnimateMode,
    BaseAnnotation3D,
    RolloverModifier3D,
    LegendModifier,
    ELegendPlacement,
    ELegendOrientation,
    TextAnnotation3D
} from "scichart";

async function initSciChart() {
    // Create the SciChart3D surface
    const { sciChart3DSurface, wasmContext } = await SciChart3DSurface.create(
        "gradientDescentChart",
        {
            theme: new SciChartJsNavyTheme(),
            worldDimensions: new Vector3(300, 200, 300),
            cameraOptions: {
                position: new Vector3(-350, 170, 350),
                target: new Vector3(0, 50, 0),
            }
        }
    );

    // Create x, y, z axis
    sciChart3DSurface.xAxis = new NumericAxis3D(wasmContext, {
        axisTitle: "X",
        visibleRange: new NumberRange(-5, 5),
        drawLabels: false,
        drawMajorBands: false,
        drawMinorGridLines: false,
        drawMajorGridLines: false,
        drawMajorTickLines: false,
    });
    sciChart3DSurface.yAxis = new NumericAxis3D(wasmContext, {
        axisTitle: "Y",
        visibleRange: new NumberRange(0, 10),
        drawLabels: false,
        drawMajorBands: false,
        drawMinorGridLines: false,
        drawMajorGridLines: false,
        drawMajorTickLines: false,
    });
    sciChart3DSurface.zAxis = new NumericAxis3D(wasmContext, {
        axisTitle: "Z",
        visibleRange: new NumberRange(-5, 5),
        AxisAlignment: EAxisAlignment.Left,
        drawLabels: false,
        drawMajorBands: false,
        drawMinorGridLines: false,
        drawMajorGridLines: false,
        drawMajorTickLines: false,
    });

    // Generate data for a paraboloid surface
    const data = generateData();

    // Add a surface mesh to display the bowl shape
    const { surfaceMesh, xyzDataSeries } = await addSurfaceMesh(sciChart3DSurface, wasmContext, data);

    // Add the arrows to the chart
    const gradientArrows = await addGradientArrows(sciChart3DSurface, wasmContext, xyzDataSeries, data);

    // Add gradient descent path
    const gradientDescentPath = await addGradientDescentPath(sciChart3DSurface, wasmContext);

    // Optional: Add a legend
    const legendModifier = new LegendModifier({
        placement: ELegendPlacement.TopLeft,
        orientation: ELegendOrientation.Vertical,
        backgroundColor: "#21282d"
    });
    sciChart3DSurface.chartModifiers.add(legendModifier);

    // Add the rolloverModifier to the chart and to the legend
    const rolloverModifier = new RolloverModifier3D();
    legendModifier.excludedModifiers.add(rolloverModifier.type);
    sciChart3DSurface.chartModifiers.add(rolloverModifier);

    // Add annotations to describe the chart elements
    addAnnotations(sciChart3DSurface, wasmContext);

    // Remove some of the annotations on resize for a better visibility
    const onResize = () => {
        if (sciChart3DSurface.viewport.width < 600) {
            gradientArrows.get(2).opacity = 0;
            gradientArrows.get(4).opacity = 0;
            gradientArrows.get(6).opacity = 0;
            gradientArrows.get(8).opacity = 0;
        } else {
            gradientArrows.get(2).opacity = 1;
            gradientArrows.get(4).opacity = 1;
            gradientArrows.get(6).opacity = 1;
            gradientArrows.get(8).opacity = 1;
        }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return {sciChart3DSurface, wasmContext, surfaceMesh, gradientArrows, gradientDescentPath};
}

function generateData() {
    const xStep = 0.4;
    const zStep = 0.4;
    const xSize = Math.floor(15 / xStep);
    const zSize = Math.floor(15 / zStep);
    const data = [];

    for (let z = 0; z < zSize; z++) {
        data[z] = [];
        for (let x = 0; x < xSize; x++) {
            const xCoord = -7.5 + x * xStep;
            const zCoord = -7.5 + z * zStep;
            const yCoord = xCoord * xCoord / 9 + zCoord * zCoord / 9;
            data[z][x] = { x: xCoord, y: yCoord, z: zCoord };
        }
    }
    return data;
}

async function addSurfaceMesh(sciChart3DSurface, wasmContext, data) {
    const {
        UniformGridDataSeries3D,
        MeshRenderableSeries3D,
        EFillPaletteMode
    } = SciChart3DSurface;

    const xSize = data[0].length;
    const zSize = data.length;

    const gradientDataProvider = {
        // Return color for z,x coord. 
        getColor: (zCoord, xCoord) => {
            const yCoord = data[zCoord][xCoord].y;
            const fraction = yCoord / 10.0; // Assuming max height is 10
            const opacity = 0.5 + 0.5 * fraction;
            const red = Math.round(255 * fraction);
            const green = Math.round(255 * (1 - fraction));
            return ((Math.round(opacity * 255) << 24) | (red << 16) | (green << 8) | 0xFF) >>> 0;
        }
    };

    // Create a dataseries. This defines how the data is laid out to the X,Y,Z axis
    const xyzDataSeries = new UniformGridDataSeries3D(wasmContext, {
        xStart: -7.5,
        xStep: 0.4,
        zStart: -7.5,
        zStep: 0.4,
        yValues: data.map(row => row.map(point => point.y)),
    });
    xyzDataSeries.dataDistribution = "Even";

    const pointMetadata = new Array(zSize);
    for (let z = 0; z < zSize; z++) {
        pointMetadata[z] = new Array(xSize);
        for (let x = 0; x < xSize; x++) {
            pointMetadata[z][x] = {
                vertexColorAbgr: gradientDataProvider.getColor(z, x),
            };
        }
    }
    xyzDataSeries.updatePointMetadata(pointMetadata);

    // Create the surface mesh, passing the dataseries and some options
    const surfaceMesh = new MeshRenderableSeries3D(wasmContext, {
        dataSeries: xyzDataSeries,
        meshColor: 0xffd49524,
        paletteMode: EFillPaletteMode.SOLID,
        stroke: 0xFF333333,
        strokeThickness: 0.5,
        name: "Cost Function Surface",
        opacity: 0.5
    });
    // Add the renderable series to the chart
    sciChart3DSurface.renderableSeries.add(surfaceMesh);

    return { surfaceMesh, xyzDataSeries };
}

async function addGradientArrows(sciChart3DSurface, wasmContext, xyzDataSeries, data) {
    const gradientArrows = [];
    const arrowOffset = 0.5; // Offset to place arrows slightly above the surface
    for (let z = 10; z < data.length; z += 8) {
        for (let x = 10; x < data[0].length; x += 8) {
            const xValue = xyzDataSeries.getXValues().get(x);
            const zValue = xyzDataSeries.getZValues().get(z);
            const yValue = data[z][x].y;

            // Calculate gradient (partial derivatives)
            const dx = 2 * xValue / 9;
            const dz = 2 * zValue / 9;

            // Arrow length based on gradient magnitude
            const arrowLength = Math.sqrt(dx * dx + dz * dz);

            // Create arrow annotation
            const arrow = new ArrowAnnotation3D({
                x1: xValue,
                y1: yValue + arrowOffset,
                z1: zValue,
                x2: xValue + dx,
                y2: yValue + arrowOffset + arrowLength,
                z2: zValue + dz,
                stroke: 0xffdc143c,
                strokeThickness: 3,
                opacity: 0, // Opacity is 0 on load and will be changed on resize depending on the screen size
                name: "Gradient Arrow",
                // Enable tooltip
                getTooltipContent: (data) => [
                    `Gradient at (${data.x1.toFixed(2)}, ${data.z1.toFixed(2)})`,
                    `dx: ${dx.toFixed(2)}`,
                    `dz: ${dz.toFixed(2)}`,
                ],
            });
            // Add the annotation to the Annotations3D collection
            sciChart3DSurface.annotations.add(arrow);
            gradientArrows.push(arrow);
        }
    }

    return gradientArrows;
}

async function addGradientDescentPath(sciChart3DSurface, wasmContext) {
    const {
        LineAnnotation3D,
    } = SciChart3DSurface;

    const learningRate = 0.4;
    let x = -6;
    let z = -6;
    let y = x * x / 9 + z * z / 9;
    let dx = 2 * x / 9;
    let dz = 2 * z / 9;
    const gradientDescentPath = [];

    for (let i = 0; i < 10; i++) {
        const x1 = x;
        const y1 = y;
        const z1 = z;

        x -= learningRate * dx;
        z -= learningRate * dz;
        y = x * x / 9 + z * z / 9;

        const line = new LineAnnotation3D({
            x1,
            y1: y1 + 0.05,
            z1,
            x2: x,
            y2: y + 0.05,
            z2: z,
            stroke: 0xff0000ff,
            strokeThickness: 3,
            name: "Gradient Descent Path",
            // Enable tooltip
            getTooltipContent: (data) => [
                `Step ${i + 1}`,
                `x: ${data.x1.toFixed(2)}`,
                `z: ${data.z1.toFixed(2)}`,
                `y: ${data.y1.toFixed(2)}`,
            ],
        });
        sciChart3DSurface.annotations.add(line);
        gradientDescentPath.push(line);

        dx = 2 * x / 9;
        dz = 2 * z / 9;
    }

    return gradientDescentPath;
}

async function addAnnotations(sciChart3DSurface, wasmContext) {
    sciChart3DSurface.annotations.add(
        new TextAnnotation3D({
            x1: -7,
            y1: 9,
            z1: 5,
