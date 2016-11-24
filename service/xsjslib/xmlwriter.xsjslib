/*
Copyright 2016 Just-BI BV, Roland Bouman (roland.bouman@just-bi.nl)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
(function(exports){

var entities = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"'": "&apos;",
	"\"": "&quot;"
};


function escapeXmlText(value) {
	if (typeof value !== "string") {
		return value;
	}
	return value.replace(/[&<>]/g, function(match){
		return entities[match];
	});
}


function escapeXmlAttribute(value) {
	if (typeof value !== "string") {
		return value;
	}
	return value.replace(/[&<>'"]/g, function(match){
		return entities[match];
	});
}

var XmlWriter;
XmlWriter = function(){
	this.buffer = [];
	this.elementStack = [];
	this.namespaceStack = [];
	this.elementOpen = false;
};
XmlWriter.prototype = {
	setDefaultNs: function(namespace){
		this.defaultNamespace = namespace;
	},
	getNsPrefix: function(namespace){
		if (namespace === "http://www.w3.org/XML/1998/namespace" || namespace === "xml"){
			return "xml";
		}
		var namespaceStack = this.namespaceStack;
		var i, ns, n = namespaceStack.length - 1;
		for (i = n; i >= 0; i--) {
			ns = namespaceStack[i];
			if (ns.namespace === namespace) {
				return ns.prefix;
			}
		}
		return null;
	},
	declareNs: function(prefix, ns) {
		this.buffer.push(" xmlns" + (prefix ? ":" + prefix : "") + "=\"" + escapeXmlAttribute(ns) + "\"");
		this.namespaceStack.push({
			namespace: ns,
			element: this.elementStack.length,
			prefix: prefix
		});
	},
	closeStartTag: function(){
		if (this.elementOpen === true) {
			this.buffer.push(">");
			this.elementOpen = false;
		}
	},
	openElement: function(name, ns){
		this.closeStartTag();
		var declareNs = false, prefix;
		if (ns) {
			prefix = this.getNsPrefix(ns);
			if (prefix === null) {
                var namespaceStack = this.namespaceStack;
				prefix = "ns" + namespaceStack.length;
				declareNs = true;
			}
			if (prefix) {
				name = prefix + ":" + name;
			}
		}
		else {
			prefix = "";
		}
		this.buffer.push("<" + name);
		if (declareNs) {
			this.declareNs(prefix, ns);
		}
		this.elementStack.push(name);
		this.elementOpen = true;
	},
	closeElement: function(){
		var elementStack = this.elementStack;
		var namespaceStack = this.namespaceStack;
		while (namespaceStack.length && namespaceStack[namespaceStack.length - 1].element === elementStack.length) {
			namespaceStack.pop();
		}

		var el = elementStack.pop();
		if (this.elementOpen) {
			this.buffer.push("/>");
			this.elementOpen = false;
		}
		else {
			this.buffer.push("</" + el + ">");
		}
	},
	writePI: function(target, content){
		this.buffer.push("<?" + target + " " + content + "?>");
	},
	writeXmlDeclaration: function(encoding, standalone){
		var text = "version=\"1.0\"";
		encoding = encoding || "UTF-8";
		text += " encoding=\"" + encoding + "\"";
		if (standalone === undefined) {
			standalone = true;
		}
		text += " standalone=\"" + (standalone ? "yes" : "no") + "\"";
		this.writePI("xml", text);
	},
	writeAttribute: function(name, value, ns){
		if (!this.elementOpen) {
			throw "No opened element";
		}
		if (ns) {
			ns = this.getNsPrefix(ns);
		}
		else {
			ns = "";
		}

		if (ns) {
			ns += ":";
		}

		value = escapeXmlAttribute(value);
		this.buffer.push(" " + ns + name + "=\"" + value + "\"");
	},
	writeAttributes: function(attributes, ns){
		if (!this.elementOpen) {
			throw "No opened element";
		}

		if (ns) {
			ns = this.getNsPrefix(ns);
		}
		else {
			ns = "";
		}

		if (ns) {
			ns += ":";
		}

		var name, value;
		for (name in attributes){
			if (attributes.hasOwnProperty(name)) {
				value = escapeXmlAttribute(attributes[name]);
				this.buffer.push(" " + ns + name + "=\"" + value + "\"");
			}
		}
	},
	writeText: function(text){
		this.closeStartTag();
		text = escapeXmlText(text);
		this.buffer.push(text);
	},
	asXml: function(){
		return this.buffer.join("");
	},
	clear: function(){
		this.buffer.length = 0;
		this.elementStack.length = 0;
		this.namespaceStack.length = 0;
		this.elementOpen = false;
	}
};

exports.XmlWriter = XmlWriter;
exports.escapeXmlText = escapeXmlText;
exports.escapeXmlAttribute = escapeXmlAttribute;

}(this));
