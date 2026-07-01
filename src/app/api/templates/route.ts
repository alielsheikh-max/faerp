import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { database } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Restrict template downloads to authenticated admins or agents
    requireRole(["AD", "WH", "SC"]);
  } catch (err) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "items") {
    // Column order matches screenshot:
    // Category | MOQ | Item Name | Transportation per Item/EGP | TIER | Range 1 | Discount 1 | Range 2 | Discount 2 | Range 3 | Discount 3 | Range 4 | Discount 4
    const headers = "Category,MOQ,Item Name,Transportation per Item/EGP,TIER,Range 1,Discount 1,Range 2,Discount 2,Range 3,Discount 3,Range 4,Discount 4\n";
    const sampleRow1 = `"بالتات خشبية",200,"بالتة خشبية يورو قياسية",25,yes,"1-100",0,"101-200",5,"201-300",10,"301+",15\n`;
    const sampleRow2 = `"صناديق كرتونية",100,"صندوق كرتون مزدوج كبير",15,yes,"1-50",0,"51-150",5,"151-250",8,"251+",12\n`;
    const sampleRow3 = `"أكياس بلاستيكية",500,"كيس بلاستيك 50 كيلو",8,no,,,,,,,,\n`;

    const csvContent = "\ufeff" + headers + sampleRow1 + sampleRow2 + sampleRow3;
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"items_template.csv\"",
      },
    });
  }

  if (type === "suppliers") {
    const headers = "Supplier Name (اسم المورد),Supplier Code (كود المورد),Contact Person Job (وظيفة الشخص المسئول),Contact Person Name (اسم الشخص المسئول),Phone (رقم الهاتف),Represented Products (المنتجات التي يعمل بها الممثل),Email (إيميل),Region (المنطقة),Address (العنوان)\n";
    const sampleRow = `"الشركة العربية للتوريدات","SUP-101","مدير المبيعات","أحمد علي","+20-100-1234567","بالتات خشبية وبلاستيكية","info@arabiansupplies.com","القاهرة","المنطقة الصناعية، التجمع الخامس"\n`;
    
    // Add BOM for UTF-8 Excel support
    const csvContent = "\ufeff" + headers + sampleRow;
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"suppliers_template.csv\"",
      },
    });
  }

  if (type === "historical_prices") {
    const headers = "Month,Item ID,Supplier ID,Price,Notes,Collected By\n";
    const sampleRow = `2026-05,1,2,350.00,Historical price entry,Admin Bulk\n`;
    const csvContent = "\ufeff" + headers + sampleRow;
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"historical_prices_template.csv\"",
      },
    });
  }

  if (type === "system_ids") {
    const db = database();
    const categories = db.prepare("SELECT id, name FROM categories ORDER BY id").all() as Array<{ id: number; name: string }>;
    const suppliers = db.prepare("SELECT id, name, region FROM suppliers ORDER BY id").all() as Array<{ id: number; name: string; region: string | null }>;
    const items = db.prepare(`
      SELECT i.id, i.name, c.name AS category_name 
      FROM items i 
      JOIN categories c ON i.category_id = c.id 
      ORDER BY i.id
    `).all() as Array<{ id: number; name: string; category_name: string }>;

    let csvContent = "\ufeffRecord Type,ID,Name,Extra Details\n";
    
    for (const c of categories) {
      csvContent += `Category,${c.id},"${c.name.replace(/"/g, '""')}",\n`;
    }
    for (const s of suppliers) {
      const extra = s.region ? `Region: ${s.region}` : "";
      csvContent += `Supplier,${s.id},"${s.name.replace(/"/g, '""')}","${extra.replace(/"/g, '""')}"\n`;
    }
    for (const i of items) {
      const extra = `Category: ${i.category_name}`;
      csvContent += `Item,${i.id},"${i.name.replace(/"/g, '""')}","${extra.replace(/"/g, '""')}"\n`;
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"system_ids_export.csv\"",
      },
    });
  }

  return new NextResponse("Template type not found", { status: 400 });
}
