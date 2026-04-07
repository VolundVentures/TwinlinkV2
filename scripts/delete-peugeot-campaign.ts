import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function main() {
  // Find Peugeot brand
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .ilike("name", "%peugeot%");
  
  console.log("Peugeot brands:", brands);
  if (!brands || brands.length === 0) { console.log("No Peugeot brand found"); return; }
  
  const brandId = brands[0].id;
  
  // Find campaigns for this brand
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status")
    .eq("brand_id", brandId);
  
  console.log("Campaigns:", campaigns);
  if (!campaigns || campaigns.length === 0) { console.log("No campaigns found"); return; }
  
  for (const campaign of campaigns) {
    console.log(`Deleting campaign: ${campaign.name} (${campaign.id})`);
    
    // Delete campaign items first
    const { data: items, error: itemsErr } = await supabase
      .from("campaign_items")
      .delete()
      .eq("campaign_id", campaign.id)
      .select("id");
    
    console.log(`  Deleted ${items?.length || 0} items`, itemsErr?.message || "");
    
    // Delete the campaign
    const { error: campErr } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaign.id);
    
    console.log(`  Campaign deleted`, campErr?.message || "OK");
  }
  
  console.log("Done!");
}

main().catch(console.error);
