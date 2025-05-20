# VIA YOLO ZIP Export

This is a ZIP-based implementation of the YOLO export functionality for the [VGG Image Annotator (VIA)](https://www.robots.ox.ac.uk/~vgg/software/via/). This implementation provides an alternative to the default single-file JSON export, allowing users to export their annotations directly in the YOLO format with a ZIP file containing individual text files for each image.

## Features

- Exports annotations in YOLO format (normalized coordinates)
- Creates a ZIP file containing:
  - `classes.txt` with class names
  - Individual `.txt` files for each image's annotations
- Compatible with YOLOv8 training
- No additional post-processing required

## Usage

1. Include the `yolo_zip_export.js` file in your VIA project
2. Add the export option to your VIA interface
3. Export your annotations using the "Export as YOLO (ZIP)" option

## Example

```javascript
// Add to your VIA interface
{
  name: 'Export as YOLO (ZIP)',
  action: function() {
    this.export_to_yolo_zip();
  }
}
```

## Dependencies

- [JSZip](https://stuk.github.io/jszip/) - For creating ZIP files

## License

MIT License - See LICENSE file for details

## Author

[Hermona Addisu] - Original implementation of the ZIP-based YOLO export for VIA

## Acknowledgments

- VGG Image Annotator (VIA) team for the base implementation
- JSZip library for ZIP file handling 
