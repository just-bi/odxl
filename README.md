# odxl

[![Join the chat at https://gitter.im/just-bi/odxl](https://badges.gitter.im/just-bi/odxl.svg)](https://gitter.im/just-bi/odxl?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

ODXL - Open Data Export Layer for SAP/HANA
==========================================
ODXL is a framework that provides generic data export capabilities for the SAP/HANA platform.
It is implemented as a xsjs Web service that understand OData web requests, and delivers a response by means of a pluggable data output handler.
Developers can use ODXL as a back-end component, or even as a global instance-wide service to provide clean, performant and extensible data export capabilities for their SAP/HANA applications.

Currently, ODXL provides output handlers for comma-separated values (csv) as well as Microsoft Excel output. 
However, ODXL is designed so that developers can write their own response handlers and extend ODXL to export data to other output formats according to their requirements.

ODXL is provided by Just BI to the SAP/HANA developer community as open source software under the terms of the Apache 2.0 License. 
This means you are free to use, modify and distribute ODXL. For the exact terms and conditions, please refer to the license text.

The source code is available on github. Developers are encouraged to check out the source code and to contribute to the project.
You can contribute in many ways: we value any feedback, suggestions for new features, filing bug reports, or code enhancements.

If you require professional support for ODXL, please contact Just-BI for details.

Installation
============
Use ODXL presumes you already have a SAP/HANA installation with a propery working xs engine. You also need HANA Studio, or Eclipse with the SAP HANA Tools plugin installed.
The steps are a little bit different, depending on whether you just want to use ODXL, or whether you want to actively develop the ODXL project.

Here are the steps if you just want to use ODXL, and currently have no need to actively develop the project:

1. In HANA Studio/Eclipse, create a new HANA xs project. Alternatively, find an existing HANA xs project.
2. Find the ODXL repository on github, and download the project as a zipped folder. (Select a particular branch if you desire so; typically you'll want to get the master branch)
3. Extract the project from the zip. This will yield a folder. Copy its contents, and place them into your xs project directory (or one of its sub directories)
4. Activate the new content.

After taking these steps, you should now have a working ODXL service, as well as a sample application.
The service itself is in the service subdirectory, and you'll find the sample application inside the app subdirectory.

The service and the application are both self-contained xs applications, and should be completely independent in terms of resources. 
The service does not require the application to be present, but obviously, the application does rely on being able to call upon the service.

If you only need the service, for example, because you want to call it directly from your own sample application, then you don't need the sample application.
You can safely copy only the contents of the service directory and put those right inside your project directory (or one of its subdirectories) in that case.
But even then, you might still want to hang on to the sample application, because you can use that to generate the web service calls that you might want to do from within your application.

What versions of SAP/HANA are supported?
========================================
We initially built and tested ODXL on SPS9. 
The initial implementation used the $.hdb database interface, as well as the $.util.Zip builtin.

We then built abstraction layers for both database access and zip support to allow automtic fallback to the $.db database interface, and to use a pure javascript implementation of the zip algorithm based on Stuart Knightley's JSZip library.
We tested this on SPS8, and everyting seems to work fine there. 

We have not actively tested earlier SAP/HANA versions, but as far as we know, ODXL should work on any earlier version. 
If you find that it doesn't, then please let us know - we will gladly look into the issue and see if we can provide a solution.
