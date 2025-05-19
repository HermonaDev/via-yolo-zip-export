/**
 * ZIP-based YOLO export implementation for VIA
 * This is an alternative to the default single-file JSON export
 */

_via_import_export.prototype.export_to_yolo_zip = function() {
  return new Promise(function(ok_callback, err_callback) {
    // Create a mapping of class names to YOLO class IDs
    var class_map = {};
    var class_list = [];
    var class_id = 0;

    console.log('Starting YOLO ZIP export...');

    // First pass: collect all unique class names from SELECT type attributes
    for (var aid in this.d.store.attribute) {
      var attribute = this.d.store.attribute[aid];
      if (attribute.type === _VIA_ATTRIBUTE_TYPE.SELECT) {
        for (var option_id in attribute.options) {
          var class_name = attribute.options[option_id];
          if (!class_map.hasOwnProperty(class_name)) {
            class_map[class_name] = class_id;
            class_list.push(class_name);
            class_id++;
          }
        }
      }
    }

    console.log('Found classes:', class_list);
    console.log('Class map:', class_map);

    // Create classes.txt content
    var classes_content = class_list.join('\n');
    
    // Create a mapping of file IDs to their annotations
    var file_annotations = {};
    var pending_image_loads = 0;
    var processed_files = new Set();

    // Function to process annotations for an image once we have its dimensions
    var process_image_annotations = function(fid, img_width, img_height) {
      if (processed_files.has(fid)) {
        return;
      }
      processed_files.add(fid);

      console.log('Processing annotations for image:', this.d.store.file[fid].fname);
      console.log('Image dimensions:', img_width, 'x', img_height);

      // Initialize empty array for this file's annotations
      if (!file_annotations[fid]) {
        file_annotations[fid] = [];
      }

      // Get all metadata entries for this file
      for (var mid in this.d.store.metadata) {
        var metadata = this.d.store.metadata[mid];
        var vid = metadata.vid;
        
        // Check if this metadata belongs to the current file
        if (!this.d.store.view[vid] || this.d.store.view[vid].fid_list[0] !== fid) {
          continue;
        }

        // Only process if it has spatial coordinates (xy) and it's a bounding box (rectangle)
        if (metadata.xy && metadata.xy.length > 0 && metadata.xy[0] === _VIA_RSHAPE.RECTANGLE) {
          var x = metadata.xy[1];
          var y = metadata.xy[2];
          var width = metadata.xy[3];
          var height = metadata.xy[4];
          
          // Get class name from the first SELECT type attribute
          for (var aid in metadata.av) {
            var attribute = this.d.store.attribute[aid];
            if (attribute.type === _VIA_ATTRIBUTE_TYPE.SELECT) {
              var option_id = metadata.av[aid];
              var class_name = attribute.options[option_id];
              
              console.log('Found annotation:', {
                class_name: class_name,
                x: x,
                y: y,
                width: width,
                height: height
              });
              
              if (class_map.hasOwnProperty(class_name)) {
                // Convert to YOLO format (normalized coordinates)
                // YOLO format: <class_id> <x_center> <y_center> <width> <height>
                var x_center = (x + width/2) / img_width;
                var y_center = (y + height/2) / img_height;
                var norm_width = width / img_width;
                var norm_height = height / img_height;
                
                // Ensure values are between 0 and 1
                x_center = Math.max(0, Math.min(1, x_center));
                y_center = Math.max(0, Math.min(1, y_center));
                norm_width = Math.max(0, Math.min(1, norm_width));
                norm_height = Math.max(0, Math.min(1, norm_height));
                
                var yolo_annotation = [
                  class_map[class_name],
                  x_center.toFixed(6),
                  y_center.toFixed(6),
                  norm_width.toFixed(6),
                  norm_height.toFixed(6)
                ].join(' ');
                
                file_annotations[fid].push(yolo_annotation);
                console.log('Added YOLO annotation:', yolo_annotation);
              }
              
              // Break after finding the first valid class attribute
              break;
            }
          }
        }
      }

      console.log('Annotations for file', this.d.store.file[fid].fname + ':', file_annotations[fid]);

      // If this was the last image to process, create the ZIP file
      pending_image_loads--;
      console.log('Remaining images to process:', pending_image_loads);
      if (pending_image_loads === 0) {
        create_zip_file.call(this);
      }
    }.bind(this);

    // Function to create and download the ZIP file
    var create_zip_file = function() {
      console.log('Creating ZIP file with annotations:', file_annotations);
      var zip = new JSZip();
      
      // Add classes.txt
      zip.file('classes.txt', classes_content);
      console.log('Added classes.txt with content:', classes_content);
      
      // Add individual annotation files
      for (var fid in file_annotations) {
        var filename = this.d.store.file[fid].fname;
        var base_name = filename.substring(0, filename.lastIndexOf('.'));
        var annotation_content = file_annotations[fid].join('\n');
        zip.file(base_name + '.txt', annotation_content);
        console.log('Added annotation file:', base_name + '.txt', 'with content:', annotation_content);
      }
      
      // Generate and download ZIP file
      zip.generateAsync({type: 'blob'}).then(function(content) {
        var filename = 'yolo_annotations.zip';
        if (this.d.store.project.pid !== '__VIA_PROJECT_ID__') {
          filename = this.d.store.project.pname.replace(' ', '-') + '_yolo.zip';
        }
        _via_util_download_as_file(content, filename);
        console.log('ZIP file generated and download initiated');
      }.bind(this));
    }.bind(this);

    // Process each image
    for (var vid in this.d.store.view) {
      var fid = this.d.store.view[vid].fid_list[0];
      var file_entry = this.d.store.file[fid];
      
      if (file_entry.type === _VIA_FILE_TYPE.IMAGE) {
        pending_image_loads++;
        
        // Create an image object to get dimensions
        var img = new Image();
        img.fid = fid;  // Store fid with the image for reference in onload
        
        img.onload = function() {
          process_image_annotations(this.fid, this.width, this.height);
        };
        
        img.onerror = function() {
          console.error('Failed to load image:', this.fid);
          pending_image_loads--;
          if (pending_image_loads === 0) {
            create_zip_file.call(this);
          }
        }.bind(this);
        
        // Set source based on file location
        if (file_entry.loc === _VIA_FILE_LOC.LOCAL && this.d.file_ref[fid]) {
          img.src = URL.createObjectURL(this.d.file_ref[fid]);
        } else {
          img.src = file_entry.src;
        }
      }
    }

    // If no images were processed, create ZIP file immediately
    if (pending_image_loads === 0) {
      create_zip_file.call(this);
    }
  }.bind(this));
}; 