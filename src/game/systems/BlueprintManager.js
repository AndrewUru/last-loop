const STORAGE_KEY = "last-loop-blueprints";
const META_KEY = "last-loop-blueprint-meta";

export default class BlueprintManager {
  static save(name, parts) {
    try {
      const blueprints = this.loadAll();
      const entry = {
        id: Date.now().toString(),
        name,
        parts,
        createdAt: new Date().toISOString(),
      };
      blueprints.push(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blueprints));
      return entry;
    } catch (e) {
      return null;
    }
  }

  static loadAll() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static load(id) {
    const blueprints = this.loadAll();
    return blueprints.find((b) => b.id === id) || null;
  }

  static delete(id) {
    try {
      const blueprints = this.loadAll().filter((b) => b.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blueprints));
      return true;
    } catch (e) {
      return false;
    }
  }

  static update(id, name) {
    try {
      const blueprints = this.loadAll();
      const idx = blueprints.findIndex((b) => b.id === id);
      if (idx !== -1) {
        blueprints[idx].name = name;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(blueprints));
        return blueprints[idx];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static saveMeta(data) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  static loadMeta() {
    try {
      const data = localStorage.getItem(META_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }
}
