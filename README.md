# node-red-contrib-ui-heatmap
A Node Red node to show a heat map

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-ui-heatmap@1.0.0-beta.1
```

## Node Usage
A heatmap (or temperature map) is a graphical representation of data, where the input values (contained in a **matrix**) are represented as colors.  Low numeric input numbers will be represented in the heatmap as *blue*, while high numeric numbers will be represented as *red*.  All other numbers in between will be represented by intermediate colors. 

In the following example flow an array of 200 random values will be calculated, and those values will be visualised in a heatmap of 20x10 size:

![Flow](/images/heatmap_flow.png)

The resulting heatmap will be updated every second by the inject node:

![Result](/images/heatmap_result.gif)
    
## Node configuration

### Rows & Columns
Define the number of rows and columns, i.e. the size of the matrix that will contain all the individual numeric values (which will be represented visually as colors in the heatmap).

***CAUTION: the product of rows * columns should equal to the length of the input array!***  
In other words, you need to specify a numeric value for 'every' cell in the result matrix.

### Specify minimum and maximum value
The minimum value will be represented as blue, while the maximum value will be represented as red.  There are two ways to specify the minimum and maximum numbers:
+ When this checkbox is selected, then the minimum and maximum numbers need to be specified manually. 
   + Advantage: This is the most precise method.
   + Disadvantage: You need to know both values in advance.
+ When this checkbox is unselected, then the node will calculate automatically the minimum and maximum (based on the input matrix numbers).  
   + Advantage: This is the simplest solution.
   + Disadvantage: The colors might be a bit incorrect.  Indeed when the input matrix numbers don't contain the highest and lowest numbers, then the he colors will deviate a bit from the real situation.

### Background color
Specify the color of the background, which is displayed behind the heatmap.

### Radius
Each point in the input matrix will have a radius, to avoid a blocky map for low-resolution matrices.

In the next example, the radius is set to ```5``` which means the individual circles will become visible in this low-resolution (20x10) heatmap:

![Radius](/images/heatmap_radius.png)

### Opacity
The opacity of the heatmap defines the transparency of the colors, and will be a value between 0 and 1.

### Blur
The higher the blur is, the smoother the color gradients will become.  The blur will be a value between 0 and 1.

## Use cases
Heatmaps can be used for a whole range of purposes:
+ Thermal image of a [building](https://www.bbc.com/news/av/technology-31611124/making-a-thermal-heat-map-of-the-us) to detect heat losses:

   ![Radius](/images/heatmap_house.png)

+ Based on [face](https://www.pinterest.co.uk/pin/402016704229719093/) heatmaps, detect whether people are happy/angry/... : 

   ![Radius](/images/heatmap_face.png)

+ Analyse where users click most of the time on a [website](http://heat-map.co/):

   ![Radius](/images/heatmap_website.png)

+ Find out the behaviour of [soccer](https://www.reddit.com/r/soccer/comments/2a6m2b/germany_vs_brazil_heat_map/) players, by tracking their positions during the game:  

   ![Radius](/images/heatmap_soccer.png)

+ Others ...
