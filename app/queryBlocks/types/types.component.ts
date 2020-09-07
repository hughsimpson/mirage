import {
  Component,
  OnChanges,
  SimpleChange,
  Input,
  Output,
  EventEmitter
} from "@angular/core";
declare var $: any;
declare var fetch;

@Component({
  selector: "types",
  templateUrl: "./app/queryBlocks/types/types.component.html",
  inputs: ["detectChange", "setProp", "buildQuery"]
})
export class TypesComponent implements OnChanges {
  @Input() mapping: any;
  @Input() config: any;
  @Input() types: any;
  @Input() selectedTypes: any;
  @Input() result: any;
  @Input() finalUrl: string;
  @Input() urlShare: any;
  @Input() version: number;
  @Output() setProp = new EventEmitter<any>();
  @Output() buildQuery = new EventEmitter<any>();

  constructor() {}

  ngOnInit() {
    var self = this;
    if (this.version >= 6) {
      setTimeout(function() {
        self.selectedTypes = ["_doc"];
        $("#setType")
          .val(self.selectedTypes)
          .trigger("change");
      });
    }
  }

  ngOnChanges(changes: { [propertyName: string]: SimpleChange }) {
    if (changes["detectChange"] && this.types.length) {
      var setType = $("#setType");
      if (setType.attr("class").indexOf("selec2") > -1) {
        setType.select2("destroy").html("");
      }
      setType.select2({
        placeholder: "Select types to apply query",
        tags: false,
        data: this.createTokenData(this.types)
      });
      setType.on(
        "change",
        function(e) {
          this.changeType(setType.val());
        }.bind(this)
      );
    }
  }

  createTokenData(types) {
    var data = [];
    types.forEach(function(val) {
      var obj = {
        id: val,
        text: val
      };
      data.push(obj);
    });
    return data;
  }

  changeType(val) {
    //this.mapping.resultQuery.result = [];
    var availableFields: any = [];
    var propInfo: any;
    var allMappings = this.mapping[this.config.appname].mappings;
    this.result.joiningQuery = [""];

    function externalLog(...args) {
      console.log("==> ", ...args)
      return fetch('http://localhost:8881/dump', {
        method: 'POST', body: JSON.stringify(args), headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then((res) => {});
    }
    function flatmap(obj: any[], fn): any[] {
      let res = []
      obj.forEach(x => res.push(...fn.call(this, x)))
      return res;
    }
    function popKey(mapObj: any, parentPath: string = ''): any[] {
      const fieldName = parentPath.replace(/\.$/, '')
      const { fields, properties, type } = mapObj;
      if (type === "nested" && this.result.joiningQuery.indexOf("nested") < 0) {
        this.result.joiningQuery.push("nested");
      }
      var obj = {
        name: fieldName,
        type: type,
        index: null
      };
      switch (type) {
        case "long":
        case "integer":
        case "short":
        case "byte":
        case "double":
        case "float":
        case "date":
          obj.type = "numeric";
          break;
        case "text":
        case "keyword":
          obj.type = "string";
          break;
      }

      const objSeq = type == null ? [] : [obj]
      const fieldsMapped: any[] = fields ? flatmap(Object.keys(fields), x =>
        popKey.call(this, fields[x], parentPath + x + '.')
      ) : []
      const propertiesMapped: any[] = properties ? flatmap(Object.keys(properties), x =>
        popKey.call(this, properties[x], parentPath + x + '.')
      ) : []
      return ([ ...objSeq, ...fieldsMapped, ...propertiesMapped ])
    }

    function feedAvailableField(mapObj: any, parent: any = null) {
      let mapObjWithFields = {};
      for (let field in mapObj) {
        mapObjWithFields[field] = mapObj[field];
        if (mapObj[field].fields) {
          for (let sub in mapObj[field].fields) {
            let subname = field + "." + sub;
            subname = parent ? parent + "." + subname : subname;
            mapObjWithFields[subname] = mapObj[field].fields[sub];
          }
        }
        if (mapObj[field].properties) {
          for (let sub in mapObj[field].properties) {
            let subname = field + "." + sub;
            subname = parent ? parent + "." + subname : subname;
            mapObjWithFields[subname] = mapObj[field].properties[sub];
          }
          feedAvailableField.call(this, mapObj[field].properties, field);
        }
        if (mapObj[field].type === "nested") {
          if (this.result.joiningQuery.indexOf("nested") < 0) {
            this.result.joiningQuery.push("nested");
          }
        }
      }
      for (var field in mapObjWithFields) {
        var index =
          typeof mapObjWithFields[field]["index"] != "undefined"
            ? mapObjWithFields[field]["index"]
            : null;
        var obj = {
          name: field,
          type: mapObjWithFields[field]["type"],
          index: index
        };
        switch (obj.type) {
          case "long":
          case "integer":
          case "short":
          case "byte":
          case "double":
          case "float":
          case "date":
            obj.type = "numeric";
            break;
          case "text":
          case "keyword":
            obj.type = "string";
            break;
        }
        availableFields.push(obj);
      }
    }

    if (val && val.length) {
      val.forEach(
        function(type: any) {
          var mapObj = allMappings[type].properties;
          feedAvailableField.call(this, mapObj);
        }.bind(this)
      );
      this.setUrl(val);
      propInfo = {
        name: "selectedTypes",
        value: val
      };
      this.setProp.emit(propInfo);
    } else {
      propInfo = {
        name: "selectedTypes",
        value: []
      };
      this.setProp.emit(propInfo);
      this.setUrl([]);
    };
    externalLog("availableFields", availableFields);
    const availableFields2: any[] = val && val.length ? flatmap(val, type => popKey.call(this, allMappings[type])) : [];
    externalLog("availableFields2", availableFields2);
    propInfo = {
      name: "availableFields",
      value: availableFields2
    };
    this.setProp.emit(propInfo);

    for (let type in allMappings) {
      if (allMappings[type].hasOwnProperty("_parent")) {
        if (val && val.indexOf(allMappings[type]["_parent"].type) > -1) {
          if (this.result.joiningQuery.indexOf("has_child") < 0) {
            this.result.joiningQuery.push("has_child");
            this.result.joiningQuery.push("has_parent");
            this.result.joiningQuery.push("parent_id");
          }
        }
      }
    }
  }

  setUrl(val: any) {
    var selectedTypes = val;
    if (!this.finalUrl) {
      console.log("Finalurl is not present");
    } else {
      var finalUrl = this.finalUrl.split("/");
      var lastUrl = "";
      // TODO: This should most definitely not be hardcoded, but the reasoning is:
      //  - this used to expect http(s?):, , $index, ...
      //  - we want to expect http(s?):, , chr-ui, (elastic|gateway), $index, ...
      //  - SO: We just add 2 to all the indexes. And the `.slice` is new. I think it's a bug not to have that?
      finalUrl[5] = this.config.appname;
      if (finalUrl.length > 6) {
        finalUrl = finalUrl.slice(0,6)
        finalUrl[6] = selectedTypes.join(",");
        finalUrl[7] = "_search";
        lastUrl = finalUrl.join("/");
      } else {
        var typeJoin = "" + selectedTypes.join(",");
        if (selectedTypes.length) {
          typeJoin = "/" + selectedTypes.join(",");
        }
        lastUrl = this.finalUrl + typeJoin + "/_search";
      }
      var propInfo = {
        name: "finalUrl",
        value: lastUrl
      };
      this.setProp.emit(propInfo);
    }
    setTimeout(
      function() {
        this.buildQuery.emit(null);
      }.bind(this),
      300
    );
  }
}
