const cast = {
  "string": value => value,
  "number": value => Number(value),
  "boolean": value => !!value,
  "object": value => JSON.parse(value),
}

export class CustomElement extends HTMLElement {

  protected name: string;
  protected markup: string;
  protected css: string;

  protected model: { [key: string]: any } = {};
  protected modelStructure: any;
  protected modelSetters: { [key: string]: Function } = {};

  protected actions: { [key: string]: (data: any) => void } = {};

  protected modkeys: string[] = [];
  protected controls: { [key: string]: string } = {};
  protected controlElementSelectors: string[] = [];
  protected keyspressed: string[] = [];

  constructor() { 
    super();
    this.attachShadow({ mode: "open" });
  }

  protected resetMarkup() {
    this.shadowRoot!.innerHTML = `<style>${this.css}</style>` + this.markup;
  }

  // MODEL FUNCTIONS

  protected useAttributes() {
    const attributeObserver = new MutationObserver((mutationList) => {
      mutationList.forEach((mutation) => {
        const modelProp = this.modelStructure.properties[mutation.attributeName!];
        if (!modelProp) return;
        this.setModelValue(
          mutation.attributeName!, 
          cast[modelProp.type](this.getAttribute(mutation.attributeName!))
        );
      });
    });
    attributeObserver.observe(this, { attributes: true });
  }

  public setModel(value: object) : void {
    if (this.modelStructure.order) {
      for (const prop of this.modelStructure.order) {
        if (!value.hasOwnProperty(prop)) continue;
        this.setModelValue(prop, value[prop]);
      }
    }
    const validModel = {};
    for (const prop in this.modelStructure.properties) {
      if (!value.hasOwnProperty(prop)) continue;
      this.setModelValue(prop, value[prop]);
      validModel[prop] = value[prop];
    }
    this.model = validModel;
    const modelSetter = this.modelSetters["model"];
    if (modelSetter) modelSetter(validModel);
  }

  public setModelValue(name: string, value: any) : void {
    this.validateProp(name, value);
    if (this.modelSetters[name]) {
      this.modelSetters[name](this.model[name], value);
    }
    this.model[name] = value;
  }

  private validateProp(name: string, value: any) : void {
    const propModel = this.modelStructure.properties[name];
    if (!propModel) {
      throw new Error(`[UI] -> {${this.name}} model prop {${name}} does not exist`);
    }
    const correctType = propModel.type == "array" ? Array.isArray(value) : typeof(value) == propModel.type;
    if (!correctType) {
      throw new Error(`[UI] -> {${this.name}} model prop {${name}} is type {${typeof(value)}}, but should be of type {${propModel.type}}`);
    }
  }

  public getModelValue(name: string) : any {
    if (this.model[name]) return this.model[name];
  }

  // SHADOW ROOT CONVENIENCE FUNCTIONS

  public element(selector: string) : any {
    return this.shadowRoot?.querySelector(selector);
  }

  public elements(selector: string) : NodeListOf<any> | undefined {
    return this.shadowRoot?.querySelectorAll(selector);
  }

  protected appendElement(element: any) : void {
    this.shadowRoot?.appendChild(element);
  }

  protected removeElement(selector: string) : void {
    this.shadowRoot?.removeChild(this.element(selector));
  }

  // CONTROLS

  protected useControls() {
    if (!this.modelStructure?.properties) {
      this.modelStructure = { properties: {} };
    }
    this.modelStructure.properties["controls"] = { type: "boolean" };
    this.modelSetters.controls = (oldValue, newValue) => {
      if (newValue) {
        window.addEventListener("keydown", this.keydown);
        window.addEventListener("keyup", this.keyup);
      } else {
        window.removeEventListener("keydown", this.keydown);
        window.removeEventListener("keyup", this.keyup);
      }
      if (this.modelStructure.properties.controlsActive) {
        this.setModelValue("controlsActive", newValue);
      }
    };
  }

  protected keyup = (e: KeyboardEvent) => {
    if (this.modkeys.includes(e.code)) {
      this.keyspressed = this.keyspressed.filter(k => k != `mod-${e.code}`);
    } else {
      this.keyspressed = this.keyspressed.filter(k => k != e.code);
    }
  }

  protected keydown = (e: KeyboardEvent) : void => {

    if (this.keyspressed.length > 3) {
      this.keyspressed = [];
      return;
    }

    if (this.modkeys.includes(e.code)) {
      this.keyspressed = [ `mod-${e.code}` ];
      return;
    }

    this.keyspressed.push(e.code);

    if (this.keyevent(this.keyspressed.join(" "))) {
      this.keyspressed = this.keyspressed.filter(k => k.includes("mod"));
      return;
    }

    if (this.keyspressed.length > 0) {
      this.keyspressed = this.delegateChildControls(this.keyspressed, this);
    }

    // should also reset keyspressed on leaving window
  }

  protected delegateChildControls(keyspressed: string[], element: CustomElement) : string[] {

    const keys = keyspressed.join(" ");

    for (let child of element.controlElementSelectors) {

      const element = this.element(child) as CustomElement;

      if (element.keyevent(keys)) {
        return keyspressed.filter(k => k.includes("mod"));
      }

      if (element.controlElementSelectors) {
        return element.delegateChildControls(keyspressed, element);
      }

    }

    return keyspressed;
    
  };

  protected keyevent(keys: string) : boolean {

    const control = this.controls[keys];

    if (control) {
      this.actions[control](keys);
      return true;
    }

    return false;

  }

}
