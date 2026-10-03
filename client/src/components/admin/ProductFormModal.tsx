import { useState, type SubmitEvent } from "react";
import { XIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/useAuth";
import { apiRequest } from "../../lib/api";
import { CATEGORIES, CATEGORY_NAMES } from "../../data/categories";

export type Product = {
  id: string;
  name: string;
  description?: string;
  price: string;
  originalPrice: string;
  image: string;
  category: string;
  subcategory?: string;
  // stock: string;
  stock?: number | null
};

type Props = {
  mode: "create" | "edit";
  product?: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
};

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  image: "",
  category: CATEGORY_NAMES[0],
  subcategory: "",
  stock: "",
};

export default function ProductFormModal({
  mode,
  product,
  onClose,
  onSaved,
}: Props) {
  const { token } = useAuth();
  //  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState(() => {
    if (mode === "edit" && product) {
      return {
        name: product.name,
        description: product.description || "",
        price: String(product.price),
        originalPrice: String(product.originalPrice || ""),
        image: product.image,
        category: product.category,
        subcategory: product.subcategory || "",
        stock: String(product.stock || ""),
      };
    }
    return EMPTY_FORM;
  });

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return form.image; // no new file selected, keep existing URL (edit mode)

    const formData = new FormData();
    formData.append("image", imageFile);

    const res = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Image upload failed");
    return data.url;
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    if (
      !form.name ||
      !form.price ||
      (!form.image && !imageFile) ||
      !form.category
    ) {
      toast.error("Name, price, image, and category are required");
      return;
    }

    setSaving(true);

    try {
      setUploading(true);
      const imageUrl = await uploadImage();
      setUploading(false);

      const body = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : 0,
        image: imageUrl,
        category: form.category,
        subCategory: form.subcategory,
        stock: form.stock ? Number(form.stock) : 0,
      };

      const saved =
        mode === "create"
          ? await apiRequest("/products", {
              method: "POST",
              token: token ?? undefined,
              body,
            })
          : await apiRequest(`/products/${product!.id}`, {
              method: "PATCH",
              token: token ?? undefined,
              body,
            });

      toast.success(mode === "create" ? "Product created" : "Product updated");
      onSaved(saved);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save product";
      toast.error(message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">
              {mode === "create" ? "Add New Product" : "Edit Product"}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-100 rounded-lg"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <input
              type="text"
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
            {/* <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              {CATEGORY_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select> */}

            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value, subcategory: "" })
              }
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              {CATEGORY_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={form.subcategory}
              onChange={(e) =>
                setForm({ ...form, subcategory: e.target.value })
              }
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="">Select subcategory</option>
              {CATEGORIES[form.category]?.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="string"
              placeholder="Price (₦)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
            <input
              type="string"
              placeholder="Original price (optional, for discounts)"
              value={form.originalPrice}
              onChange={(e) =>
                setForm({ ...form, originalPrice: e.target.value })
              }
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
            <input
              type="string"
              placeholder="Stock"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Product Image
              </label>
              <div className="flex items-center gap-4">
                {(imageFile || form.image) && (
                  <img
                    src={
                      imageFile ? URL.createObjectURL(imageFile) : form.image
                    }
                    alt="Preview"
                    className="size-16 rounded-lg object-cover bg-zinc-100 border border-zinc-200"
                  />
                )}
                <label className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm cursor-pointer hover:bg-zinc-50">
                  <UploadIcon className="size-4" />
                  {imageFile ? imageFile.name : "Choose an image"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 col-span-1 md:col-span-2"
            />

            <button
              type="submit"
              disabled={saving}
              className="col-span-1 md:col-span-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
            >
              {saving ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  {uploading ? "Uploading image…" : "Saving…"}
                </>
              ) : mode === "create" ? (
                "Add Product"
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
