(function(exports){

  var error = $.import("error.xsjslib");

  var zipInterfaces = {
    "$.util.Zip": function() {
      return $.util.Zip;
    },
    "jszip.xsjslib": function() {
      return $.import("jszip.xsjslib");
    }
  };

  var zipInterface;
  function setZipInterface(zInterface) {
    var func = zipInterfaces[zInterface];
    if (func === undefined) {
      error.raise("setZipInterface", null, "Unrecognized zip interface " + zInterface);
    }
    try {
      zipInterface = func.call();
      if (zipInterface === undefined) {
    	  error.raise("setZipInterface", null, "Zip interface " + zInterface + " is undefined.");
      }
      zipInterface = zInterface;
    } catch (e) {
      error.raise("setZipInterface", null, "Could not instantiate zip interface " + zInterface + " (" + e.toString() + ")", e);
    }
  }

  function getDefaultZipInterface() {
    var zipInterface;
    for (zipInterface in zipInterfaces) {
      try {
        setZipInterface(zipInterface);
        return zipInterface;
      } catch (e) {
        continue;
      }
    }
    error.raise("getDefaultZipInterface", null, "No zip interface found.");
    return null;
  }
  zipInterface = getDefaultZipInterface();

  function generateArchiveWithNativeZip(contents){
	  var archive = new $.util.Zip();
	  var k;
	  for (k in contents) {
		  archive[k] = contents[k];
	  }
      return archive;
  }

  function generateArchiveWithJsZip(contents){
	  var jsZip = $.import("jszip.xsjslib");
	  var archive = new jsZip.JSZip();

	  var k;
	  for (k in contents) {
		  archive.file(k, contents[k]);
	  }

	  archive = archive.generate({
		 compression: "DEFLATE",
		 type: "arraybuffer"
	  });
	  return archive;
  }

  function generateArchive(contents){
    var zipInterfaces = {
    	"$.util.Zip": generateArchiveWithNativeZip,
    	"jszip.xsjslib": generateArchiveWithJsZip
    };
    var zInterface = zipInterfaces[zipInterface];
    if (zInterface === undefined) {
    	error.raise("generateArchive", null, "No handler for zip interface " + zipInterface);
    }
    var archive = zInterface(contents);
    return archive;
  }

  exports.getDefaultZipInterface = getDefaultZipInterface;
  exports.setZipInterface = setZipInterface;
  exports.generate = generateArchive;

}(this));
