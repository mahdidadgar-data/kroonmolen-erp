CREATE TABLE public.customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  customer_type text NOT NULL CHECK (customer_type IN ('farm','dealer')),
  city text NOT NULL,
  country text NOT NULL CHECK (country IN ('NL','BE')),
  payment_terms_days integer NOT NULL DEFAULT 30,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  sku text PRIMARY KEY,
  name text NOT NULL,
  species text NOT NULL CHECK (species IN ('dairy','beef','broiler','layer','pig')),
  form text NOT NULL CHECK (form IN ('pellet','mash','crumble')),
  packaging text NOT NULL CHECK (packaging IN ('bag_25kg','big_bag','bulk')),
  unit_price_per_tonne numeric(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.warehouses (
  id text PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  country text NOT NULL CHECK (country IN ('NL','BE'))
);
CREATE TABLE public.inventory (
  product_sku text NOT NULL REFERENCES public.products(sku) ON DELETE CASCADE,
  warehouse_id text NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity_tonnes numeric(10,1) NOT NULL DEFAULT 0,
  reorder_level_tonnes numeric(10,1) NOT NULL DEFAULT 0,
  stock_status text GENERATED ALWAYS AS (
    CASE WHEN quantity_tonnes <= 0 THEN 'out_of_stock'
         WHEN quantity_tonnes <= reorder_level_tonnes THEN 'low'
         ELSE 'in_stock' END) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_sku, warehouse_id)
);
CREATE TABLE public.sales_orders (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES public.customers(id),
  order_date date NOT NULL,
  requested_delivery_date date NOT NULL,
  warehouse_id text NOT NULL REFERENCES public.warehouses(id),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','in_production','ready_to_ship','partially_shipped','shipped','delivered','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_orders_customer_idx ON public.sales_orders(customer_id);
CREATE TABLE public.sales_order_lines (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  product_sku text NOT NULL REFERENCES public.products(sku),
  quantity_tonnes numeric(10,1) NOT NULL CHECK (quantity_tonnes > 0),
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(12,2) GENERATED ALWAYS AS (round(quantity_tonnes * unit_price, 2)) STORED,
  UNIQUE (order_id, line_no)
);
CREATE INDEX sales_order_lines_order_idx ON public.sales_order_lines(order_id);
CREATE TABLE public.shipments (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  carrier text NOT NULL,
  quantity_tonnes numeric(10,1) NOT NULL,
  planned_date date NOT NULL,
  actual_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','loaded','in_transit','delivered','delayed')),
  delay_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipments_order_idx ON public.shipments(order_id);
CREATE TABLE public.invoices (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.sales_orders(id),
  customer_id text NOT NULL REFERENCES public.customers(id),
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  amount_excl_vat numeric(12,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL,
  amount_incl_vat numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','overdue')),
  paid_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_order_idx ON public.invoices(order_id);
CREATE INDEX invoices_customer_idx ON public.invoices(customer_id);
CREATE TABLE public.order_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  from_status text,
  to_status text,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_activity_order_idx ON public.order_activity(order_id, created_at);

GRANT SELECT ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
GRANT SELECT ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
GRANT SELECT ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;
GRANT SELECT ON public.sales_order_lines TO authenticated;
GRANT ALL ON public.sales_order_lines TO service_role;
GRANT SELECT ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT SELECT ON public.order_activity TO authenticated;
GRANT ALL ON public.order_activity TO service_role;
GRANT UPDATE ON public.sales_orders TO authenticated;
GRANT UPDATE ON public.shipments TO authenticated;
GRANT UPDATE ON public.invoices TO authenticated;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view products" ON public.products FOR SELECT TO authenticated USING (true);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view warehouses" ON public.warehouses FOR SELECT TO authenticated USING (true);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view sales_orders" ON public.sales_orders FOR SELECT TO authenticated USING (true);
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view sales_order_lines" ON public.sales_order_lines FOR SELECT TO authenticated USING (true);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view shipments" ON public.shipments FOR SELECT TO authenticated USING (true);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
ALTER TABLE public.order_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view order_activity" ON public.order_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can update sales_orders" ON public.sales_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in staff can update shipments" ON public.shipments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in staff can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.warehouses (id,name,city,country) VALUES ('WH-ZWL','Mill Zwolle','Zwolle','NL'),('WH-ANR','Depot Antwerp','Antwerp','BE');

INSERT INTO public.customers (id,name,customer_type,city,country,payment_terms_days,credit_limit,contact_email) VALUES
('CUST-1001','Hoeve Zonnekamp','farm','Dalfsen','NL',30,40000,'orders@zonnekamp.example'),
('CUST-1002','Melkvee Brakelmeer','farm','Hardenberg','NL',30,60000,'orders@brakelmeer.example'),
('CUST-1003','Varkenshouderij Ter Lindel','farm','Deurne','NL',21,75000,'orders@terlindel.example'),
('CUST-1004','Pluimvee Kraaienveld','farm','Barneveld','NL',30,90000,'orders@kraaienveld.example'),
('CUST-1005','Agrohandel Veldkamp Demo','dealer','Meppel','NL',45,180000,'orders@veldkamp-demo.example'),
('CUST-1006','Voerhandel De Gouwe Schuur','dealer','Ede','NL',45,150000,'orders@gouweschuur.example'),
('CUST-1007','Rundvee Oosterbroek','farm','Ommen','NL',30,35000,'orders@oosterbroek.example'),
('CUST-1008','Legkippen Haverland','farm','Venray','NL',14,50000,'orders@haverland.example'),
('CUST-1009','Melkveebedrijf Wilgenrode','farm','Steenwijk','NL',30,45000,'orders@wilgenrode.example'),
('CUST-1010','Agri Dealer Noordpolder','dealer','Emmeloord','NL',60,220000,'orders@noordpolder.example'),
('CUST-1011','Hof ter Distelweide','farm','Geel','BE',30,40000,'orders@distelweide.example'),
('CUST-1012','Varkensbedrijf Kempenhof Demo','farm','Hoogstraten','BE',30,70000,'orders@kempenhof-demo.example'),
('CUST-1013','Veevoeders Scheldevallei','dealer','Lokeren','BE',45,160000,'orders@scheldevallei.example'),
('CUST-1014','Pluimveehof De Brem','farm','Roeselare','BE',21,55000,'orders@debrem.example'),
('CUST-1015','Agrodepot Maasland','dealer','Maaseik','BE',60,140000,'orders@maasland.example');

INSERT INTO public.products (sku,name,species,form,packaging,unit_price_per_tonne) VALUES
('PRD-2001','KroonMelk Lactation 18','dairy','pellet','bulk',348),
('PRD-2002','KroonMelk Lactation 22 Protein','dairy','pellet','bulk',372),
('PRD-2003','KroonMelk Dry Cow','dairy','mash','big_bag',395),
('PRD-2004','KroonMelk Calf Starter','dairy','crumble','bag_25kg',520),
('PRD-2005','KroonRund Finisher','beef','pellet','bulk',335),
('PRD-2006','KroonRund Grower Mix','beef','mash','big_bag',342),
('PRD-2007','KroonRund Young Stock','beef','pellet','bag_25kg',410),
('PRD-2008','KroonKuiken Starter','broiler','crumble','bulk',468),
('PRD-2009','KroonKuiken Grower','broiler','pellet','bulk',442),
('PRD-2010','KroonKuiken Finisher','broiler','pellet','bulk',431),
('PRD-2011','KroonKuiken Starter Bagged','broiler','crumble','bag_25kg',505),
('PRD-2012','KroonLeg Layer Phase 1','layer','mash','bulk',398),
('PRD-2013','KroonLeg Layer Phase 2','layer','mash','bulk',386),
('PRD-2014','KroonLeg Pullet Rearing','layer','crumble','big_bag',415),
('PRD-2015','KroonLeg Free Range','layer','pellet','bag_25kg',448),
('PRD-2016','KroonVarken Piglet Starter','pig','crumble','bag_25kg',612),
('PRD-2017','KroonVarken Weaner','pig','pellet','big_bag',455),
('PRD-2018','KroonVarken Grower','pig','pellet','bulk',362),
('PRD-2019','KroonVarken Finisher','pig','mash','bulk',338),
('PRD-2020','KroonVarken Sow Lactation','pig','pellet','bulk',389);

INSERT INTO public.inventory (product_sku,warehouse_id,quantity_tonnes,reorder_level_tonnes) VALUES
('PRD-2001','WH-ZWL',177,45),
('PRD-2001','WH-ANR',130,40),
('PRD-2002','WH-ZWL',38,80),
('PRD-2002','WH-ANR',95,41),
('PRD-2003','WH-ZWL',99,27),
('PRD-2003','WH-ANR',4,10),
('PRD-2004','WH-ZWL',0,20),
('PRD-2004','WH-ANR',20,5),
('PRD-2005','WH-ZWL',167,51),
('PRD-2005','WH-ANR',189,76),
('PRD-2006','WH-ZWL',101,30),
('PRD-2006','WH-ANR',49,17),
('PRD-2007','WH-ZWL',43,17),
('PRD-2007','WH-ANR',7,3),
('PRD-2008','WH-ZWL',201,85),
('PRD-2008','WH-ANR',0,40),
('PRD-2009','WH-ZWL',294,94),
('PRD-2009','WH-ANR',115,56),
('PRD-2010','WH-ZWL',292,80),
('PRD-2010','WH-ANR',157,43),
('PRD-2011','WH-ZWL',37,15),
('PRD-2011','WH-ANR',6,12),
('PRD-2012','WH-ZWL',142,61),
('PRD-2012','WH-ANR',197,55),
('PRD-2013','WH-ZWL',313,84),
('PRD-2013','WH-ANR',135,62),
('PRD-2014','WH-ZWL',14,25),
('PRD-2014','WH-ANR',54,25),
('PRD-2015','WH-ZWL',38,15),
('PRD-2015','WH-ANR',29,8),
('PRD-2016','WH-ZWL',0,15),
('PRD-2016','WH-ANR',28,9),
('PRD-2017','WH-ZWL',67,33),
('PRD-2017','WH-ANR',9,18),
('PRD-2018','WH-ZWL',239,112),
('PRD-2018','WH-ANR',157,50),
('PRD-2019','WH-ZWL',55,90),
('PRD-2019','WH-ANR',153,44),
('PRD-2020','WH-ZWL',301,91),
('PRD-2020','WH-ANR',128,54);

INSERT INTO public.sales_orders (id,customer_id,order_date,requested_delivery_date,warehouse_id,status,notes,created_at) VALUES
('SO-24001','CUST-1014','2026-08-20','2026-08-29','WH-ANR','delivered',NULL,'2026-08-20 08:15:00+01'),
('SO-24002','CUST-1011','2026-08-20','2026-08-29','WH-ANR','delivered',NULL,'2026-08-20 08:15:00+01'),
('SO-24003','CUST-1003','2026-08-23','2026-08-30','WH-ZWL','delivered',NULL,'2026-08-23 08:15:00+01'),
('SO-24004','CUST-1010','2026-08-25','2026-09-03','WH-ZWL','delivered',NULL,'2026-08-25 08:15:00+01'),
('SO-24005','CUST-1002','2026-08-29','2026-09-05','WH-ZWL','delivered',NULL,'2026-08-29 08:15:00+01'),
('SO-24006','CUST-1011','2026-08-30','2026-09-08','WH-ANR','delivered',NULL,'2026-08-30 08:15:00+01'),
('SO-24007','CUST-1001','2026-09-03','2026-09-08','WH-ZWL','delivered',NULL,'2026-09-03 08:15:00+01'),
('SO-24008','CUST-1008','2026-09-06','2026-09-12','WH-ZWL','delivered',NULL,'2026-09-06 08:15:00+01'),
('SO-24009','CUST-1015','2026-09-06','2026-09-11','WH-ANR','cancelled','Cancelled after credit check','2026-09-06 08:15:00+01'),
('SO-24010','CUST-1007','2026-09-07','2026-09-16','WH-ZWL','delivered',NULL,'2026-09-07 08:15:00+01'),
('SO-24011','CUST-1013','2026-09-09','2026-09-14','WH-ANR','delivered',NULL,'2026-09-09 08:15:00+01'),
('SO-24012','CUST-1006','2026-09-11','2026-09-20','WH-ZWL','delivered',NULL,'2026-09-11 08:15:00+01'),
('SO-24013','CUST-1013','2026-09-16','2026-09-23','WH-ANR','delivered',NULL,'2026-09-16 08:15:00+01'),
('SO-24014','CUST-1005','2026-09-17','2026-09-22','WH-ZWL','delivered',NULL,'2026-09-17 08:15:00+01'),
('SO-24015','CUST-1012','2026-09-17','2026-09-26','WH-ANR','delivered',NULL,'2026-09-17 08:15:00+01'),
('SO-24016','CUST-1007','2026-09-23','2026-10-01','WH-ZWL','delivered',NULL,'2026-09-23 08:15:00+01'),
('SO-24017','CUST-1011','2026-09-23','2026-09-30','WH-ANR','delivered',NULL,'2026-09-23 08:15:00+01'),
('SO-24018','CUST-1003','2026-09-24','2026-10-03','WH-ZWL','partially_shipped','Second load waiting on soy meal delivery','2026-09-24 08:15:00+01'),
('SO-24019','CUST-1010','2026-09-24','2026-09-30','WH-ZWL','delivered',NULL,'2026-09-24 08:15:00+01'),
('SO-24020','CUST-1002','2026-09-26','2026-10-04','WH-ZWL','delivered',NULL,'2026-09-26 08:15:00+01'),
('SO-24021','CUST-1008','2026-09-26','2026-09-30','WH-ZWL','delivered',NULL,'2026-09-26 08:15:00+01'),
('SO-24022','CUST-1001','2026-09-28','2026-10-05','WH-ZWL','delivered',NULL,'2026-09-28 08:15:00+01'),
('SO-24023','CUST-1008','2026-09-29','2026-10-07','WH-ZWL','delivered',NULL,'2026-09-29 08:15:00+01'),
('SO-24024','CUST-1015','2026-09-29','2026-10-06','WH-ANR','cancelled','Customer cancelled: switched to own-mix ration','2026-09-29 08:15:00+01'),
('SO-24025','CUST-1007','2026-09-30','2026-10-08','WH-ZWL','delivered',NULL,'2026-09-30 08:15:00+01'),
('SO-24026','CUST-1007','2026-09-30','2026-10-07','WH-ZWL','delivered',NULL,'2026-09-30 08:15:00+01'),
('SO-24027','CUST-1006','2026-10-06','2026-10-10','WH-ZWL','delivered',NULL,'2026-10-06 08:15:00+01'),
('SO-24028','CUST-1013','2026-10-07','2026-10-14','WH-ANR','delivered',NULL,'2026-10-07 08:15:00+01'),
('SO-24029','CUST-1005','2026-10-09','2026-10-15','WH-ZWL','delivered',NULL,'2026-10-09 08:15:00+01'),
('SO-24030','CUST-1012','2026-10-10','2026-10-15','WH-ANR','partially_shipped','Remainder held at border, paperwork pending','2026-10-10 08:15:00+01'),
('SO-24031','CUST-1003','2026-10-10','2026-10-15','WH-ZWL','delivered',NULL,'2026-10-10 08:15:00+01'),
('SO-24032','CUST-1011','2026-10-18','2026-10-27','WH-ANR','delivered',NULL,'2026-10-18 08:15:00+01'),
('SO-24033','CUST-1003','2026-10-19','2026-10-24','WH-ZWL','delivered',NULL,'2026-10-19 08:15:00+01'),
('SO-24034','CUST-1010','2026-10-20','2026-10-27','WH-ZWL','delivered',NULL,'2026-10-20 08:15:00+01'),
('SO-24035','CUST-1002','2026-10-23','2026-10-28','WH-ZWL','delivered',NULL,'2026-10-23 08:15:00+01'),
('SO-24036','CUST-1007','2026-11-02','2026-11-10','WH-ZWL','shipped',NULL,'2026-11-02 08:15:00+01'),
('SO-24037','CUST-1001','2026-11-03','2026-11-10','WH-ZWL','delivered',NULL,'2026-11-03 08:15:00+01'),
('SO-24038','CUST-1008','2026-11-03','2026-11-07','WH-ZWL','cancelled','Cancelled after credit check','2026-11-03 08:15:00+01'),
('SO-24039','CUST-1015','2026-11-04','2026-11-11','WH-ANR','delivered',NULL,'2026-11-04 08:15:00+01'),
('SO-24040','CUST-1007','2026-11-04','2026-11-10','WH-ZWL','delivered',NULL,'2026-11-04 08:15:00+01'),
('SO-24041','CUST-1002','2026-11-05','2026-11-12','WH-ZWL','shipped',NULL,'2026-11-05 08:15:00+01'),
('SO-24042','CUST-1006','2026-11-05','2026-11-10','WH-ZWL','partially_shipped',NULL,'2026-11-05 08:15:00+01'),
('SO-24043','CUST-1013','2026-11-07','2026-11-12','WH-ANR','ready_to_ship',NULL,'2026-11-07 08:15:00+01'),
('SO-24044','CUST-1005','2026-11-08','2026-11-14','WH-ZWL','in_production',NULL,'2026-11-08 08:15:00+01'),
('SO-24045','CUST-1012','2026-11-09','2026-11-18','WH-ANR','shipped',NULL,'2026-11-09 08:15:00+01'),
('SO-24046','CUST-1011','2026-11-09','2026-11-18','WH-ANR','in_production',NULL,'2026-11-09 08:15:00+01'),
('SO-24047','CUST-1011','2026-11-09','2026-11-15','WH-ANR','in_production',NULL,'2026-11-09 08:15:00+01'),
('SO-24048','CUST-1003','2026-11-12','2026-11-20','WH-ZWL','shipped',NULL,'2026-11-12 08:15:00+01'),
('SO-24049','CUST-1010','2026-11-12','2026-11-20','WH-ZWL','ready_to_ship',NULL,'2026-11-12 08:15:00+01'),
('SO-24050','CUST-1002','2026-11-12','2026-11-16','WH-ZWL','confirmed',NULL,'2026-11-12 08:15:00+01'),
('SO-24051','CUST-1001','2026-11-13','2026-11-19','WH-ZWL','shipped',NULL,'2026-11-13 08:15:00+01'),
('SO-24052','CUST-1001','2026-11-14','2026-11-20','WH-ZWL','cancelled','Duplicate order entered by customer','2026-11-14 08:15:00+01'),
('SO-24053','CUST-1008','2026-11-14','2026-11-18','WH-ZWL','confirmed',NULL,'2026-11-14 08:15:00+01'),
('SO-24054','CUST-1015','2026-11-14','2026-11-23','WH-ANR','in_production',NULL,'2026-11-14 08:15:00+01'),
('SO-24055','CUST-1007','2026-11-14','2026-11-19','WH-ZWL','ready_to_ship',NULL,'2026-11-14 08:15:00+01'),
('SO-24056','CUST-1011','2026-11-15','2026-11-19','WH-ANR','in_production',NULL,'2026-11-15 08:15:00+01'),
('SO-24057','CUST-1006','2026-11-15','2026-11-21','WH-ZWL','in_production',NULL,'2026-11-15 08:15:00+01'),
('SO-24058','CUST-1013','2026-11-16','2026-11-20','WH-ANR','confirmed',NULL,'2026-11-16 08:15:00+01'),
('SO-24059','CUST-1005','2026-11-16','2026-11-20','WH-ZWL','confirmed',NULL,'2026-11-16 08:15:00+01'),
('SO-24060','CUST-1012','2026-11-17','2026-11-25','WH-ANR','confirmed',NULL,'2026-11-17 08:15:00+01');

INSERT INTO public.sales_order_lines (id,order_id,line_no,product_sku,quantity_tonnes,unit_price) VALUES
('SO-24001-1','SO-24001',1,'PRD-2009',16,442.0),
('SO-24001-2','SO-24001',2,'PRD-2008',30,468.0),
('SO-24002-1','SO-24002',1,'PRD-2007',2,410.0),
('SO-24002-2','SO-24002',2,'PRD-2001',28,348.0),
('SO-24003-1','SO-24003',1,'PRD-2019',14,338.0),
('SO-24003-2','SO-24003',2,'PRD-2016',5,612.0),
('SO-24003-3','SO-24003',3,'PRD-2020',14,389.0),
('SO-24004-1','SO-24004',1,'PRD-2008',24,453.96),
('SO-24004-2','SO-24004',2,'PRD-2016',8,593.64),
('SO-24004-3','SO-24004',3,'PRD-2014',8,402.55),
('SO-24004-4','SO-24004',4,'PRD-2007',6,397.7),
('SO-24005-1','SO-24005',1,'PRD-2001',30,348.0),
('SO-24005-2','SO-24005',2,'PRD-2007',2,410.0),
('SO-24005-3','SO-24005',3,'PRD-2005',18,335.0),
('SO-24006-1','SO-24006',1,'PRD-2002',16,372.0),
('SO-24006-2','SO-24006',2,'PRD-2007',3,410.0),
('SO-24007-1','SO-24007',1,'PRD-2005',12,335.0),
('SO-24008-1','SO-24008',1,'PRD-2014',8,415.0),
('SO-24009-1','SO-24009',1,'PRD-2005',28,324.95),
('SO-24009-2','SO-24009',2,'PRD-2012',28,386.06),
('SO-24009-3','SO-24009',3,'PRD-2003',16,383.15),
('SO-24010-1','SO-24010',1,'PRD-2006',4,342.0),
('SO-24010-2','SO-24010',2,'PRD-2005',28,335.0),
('SO-24010-3','SO-24010',3,'PRD-2007',3,410.0),
('SO-24011-1','SO-24011',1,'PRD-2006',20,331.74),
('SO-24011-2','SO-24011',2,'PRD-2015',3.0,434.56),
('SO-24011-3','SO-24011',3,'PRD-2018',56,351.14),
('SO-24012-1','SO-24012',1,'PRD-2004',10,504.4),
('SO-24012-2','SO-24012',2,'PRD-2012',56,386.06),
('SO-24012-3','SO-24012',3,'PRD-2018',60,351.14),
('SO-24013-1','SO-24013',1,'PRD-2007',4,397.7),
('SO-24013-2','SO-24013',2,'PRD-2015',8,434.56),
('SO-24013-3','SO-24013',3,'PRD-2012',32,386.06),
('SO-24014-1','SO-24014',1,'PRD-2002',32,360.84),
('SO-24014-2','SO-24014',2,'PRD-2004',8,504.4),
('SO-24014-3','SO-24014',3,'PRD-2014',12,402.55),
('SO-24015-1','SO-24015',1,'PRD-2020',28,389.0),
('SO-24015-2','SO-24015',2,'PRD-2018',18,362.0),
('SO-24016-1','SO-24016',1,'PRD-2007',2,410.0),
('SO-24016-2','SO-24016',2,'PRD-2006',10,342.0),
('SO-24016-3','SO-24016',3,'PRD-2005',28,335.0),
('SO-24017-1','SO-24017',1,'PRD-2006',10,342.0),
('SO-24017-2','SO-24017',2,'PRD-2005',18,335.0),
('SO-24018-1','SO-24018',1,'PRD-2020',24,389.0),
('SO-24018-2','SO-24018',2,'PRD-2018',18,362.0),
('SO-24018-3','SO-24018',3,'PRD-2017',8,455.0),
('SO-24019-1','SO-24019',1,'PRD-2005',28,324.95),
('SO-24019-2','SO-24019',2,'PRD-2020',56,377.33),
('SO-24020-1','SO-24020',1,'PRD-2007',4,410.0),
('SO-24021-1','SO-24021',1,'PRD-2014',10,415.0),
('SO-24021-2','SO-24021',2,'PRD-2015',2,448.0),
('SO-24022-1','SO-24022',1,'PRD-2001',16,348.0),
('SO-24023-1','SO-24023',1,'PRD-2014',4,415.0),
('SO-24024-1','SO-24024',1,'PRD-2012',60,386.06),
('SO-24024-2','SO-24024',2,'PRD-2006',8,331.74),
('SO-24024-3','SO-24024',3,'PRD-2004',8,504.4),
('SO-24025-1','SO-24025',1,'PRD-2005',28,335.0),
('SO-24026-1','SO-24026',1,'PRD-2006',10,342.0),
('SO-24027-1','SO-24027',1,'PRD-2015',6,434.56),
('SO-24027-2','SO-24027',2,'PRD-2008',24,453.96),
('SO-24027-3','SO-24027',3,'PRD-2020',28,377.33),
('SO-24028-1','SO-24028',1,'PRD-2016',3.0,593.64),
('SO-24028-2','SO-24028',2,'PRD-2020',32,377.33),
('SO-24028-3','SO-24028',3,'PRD-2015',6,434.56),
('SO-24029-1','SO-24029',1,'PRD-2004',4,504.4),
('SO-24029-2','SO-24029',2,'PRD-2007',6,397.7),
('SO-24029-3','SO-24029',3,'PRD-2011',3.0,489.85),
('SO-24030-1','SO-24030',1,'PRD-2016',4,612.0),
('SO-24030-2','SO-24030',2,'PRD-2020',18,389.0),
('SO-24031-1','SO-24031',1,'PRD-2018',12,362.0),
('SO-24031-2','SO-24031',2,'PRD-2016',5,612.0),
('SO-24031-3','SO-24031',3,'PRD-2019',18,338.0),
('SO-24032-1','SO-24032',1,'PRD-2003',4,395.0),
('SO-24033-1','SO-24033',1,'PRD-2018',12,362.0),
('SO-24033-2','SO-24033',2,'PRD-2019',30,338.0),
('SO-24034-1','SO-24034',1,'PRD-2015',6,434.56),
('SO-24034-2','SO-24034',2,'PRD-2010',48,418.07),
('SO-24035-1','SO-24035',1,'PRD-2005',18,335.0),
('SO-24035-2','SO-24035',2,'PRD-2006',10,342.0),
('SO-24036-1','SO-24036',1,'PRD-2005',16,335.0),
('SO-24036-2','SO-24036',2,'PRD-2006',10,342.0),
('SO-24037-1','SO-24037',1,'PRD-2007',5,410.0),
('SO-24037-2','SO-24037',2,'PRD-2001',14,348.0),
('SO-24038-1','SO-24038',1,'PRD-2012',30,398.0),
('SO-24038-2','SO-24038',2,'PRD-2014',8,415.0),
('SO-24039-1','SO-24039',1,'PRD-2015',10,434.56),
('SO-24039-2','SO-24039',2,'PRD-2018',48,351.14),
('SO-24039-3','SO-24039',3,'PRD-2005',32,324.95),
('SO-24040-1','SO-24040',1,'PRD-2007',2,410.0),
('SO-24040-2','SO-24040',2,'PRD-2006',10,342.0),
('SO-24040-3','SO-24040',3,'PRD-2005',30,335.0),
('SO-24041-1','SO-24041',1,'PRD-2004',1.5,520.0),
('SO-24041-2','SO-24041',2,'PRD-2001',18,348.0),
('SO-24041-3','SO-24041',3,'PRD-2002',24,372.0),
('SO-24042-1','SO-24042',1,'PRD-2008',24,453.96),
('SO-24042-2','SO-24042',2,'PRD-2003',16,383.15),
('SO-24042-3','SO-24042',3,'PRD-2014',16,402.55),
('SO-24043-1','SO-24043',1,'PRD-2003',12,383.15),
('SO-24043-2','SO-24043',2,'PRD-2013',36,374.42),
('SO-24043-3','SO-24043',3,'PRD-2008',32,453.96),
('SO-24044-1','SO-24044',1,'PRD-2014',16,402.55),
('SO-24044-2','SO-24044',2,'PRD-2009',36,428.74),
('SO-24044-3','SO-24044',3,'PRD-2015',10,434.56),
('SO-24045-1','SO-24045',1,'PRD-2016',5,612.0),
('SO-24045-2','SO-24045',2,'PRD-2019',30,338.0),
('SO-24046-1','SO-24046',1,'PRD-2006',4,342.0),
('SO-24047-1','SO-24047',1,'PRD-2001',16,348.0),
('SO-24048-1','SO-24048',1,'PRD-2020',30,389.0),
('SO-24048-2','SO-24048',2,'PRD-2018',30,362.0),
('SO-24049-1','SO-24049',1,'PRD-2013',32,374.42),
('SO-24049-2','SO-24049',2,'PRD-2001',32,337.56),
('SO-24050-1','SO-24050',1,'PRD-2003',4,395.0),
('SO-24050-2','SO-24050',2,'PRD-2005',28,335.0),
('SO-24050-3','SO-24050',3,'PRD-2002',12,372.0),
('SO-24051-1','SO-24051',1,'PRD-2001',14,348.0),
('SO-24051-2','SO-24051',2,'PRD-2007',5,410.0),
('SO-24052-1','SO-24052',1,'PRD-2006',6,342.0),
('SO-24053-1','SO-24053',1,'PRD-2014',8,415.0),
('SO-24053-2','SO-24053',2,'PRD-2012',12,398.0),
('SO-24054-1','SO-24054',1,'PRD-2002',28,360.84),
('SO-24054-2','SO-24054',2,'PRD-2011',10,489.85),
('SO-24055-1','SO-24055',1,'PRD-2007',2,410.0),
('SO-24056-1','SO-24056',1,'PRD-2003',6,395.0),
('SO-24057-1','SO-24057',1,'PRD-2014',8,402.55),
('SO-24057-2','SO-24057',2,'PRD-2017',16,441.35),
('SO-24057-3','SO-24057',3,'PRD-2004',8,504.4),
('SO-24058-1','SO-24058',1,'PRD-2015',8,434.56),
('SO-24058-2','SO-24058',2,'PRD-2001',56,337.56),
('SO-24058-3','SO-24058',3,'PRD-2002',56,360.84),
('SO-24059-1','SO-24059',1,'PRD-2020',28,377.33),
('SO-24059-2','SO-24059',2,'PRD-2005',56,324.95),
('SO-24059-3','SO-24059',3,'PRD-2003',16,383.15),
('SO-24060-1','SO-24060',1,'PRD-2019',12,338.0),
('SO-24060-2','SO-24060',2,'PRD-2016',4,612.0),
('SO-24060-3','SO-24060',3,'PRD-2018',16,362.0);

INSERT INTO public.shipments (id,order_id,carrier,quantity_tonnes,planned_date,actual_date,status,delay_reason) VALUES
('SHP-30001','SO-24001','Own fleet Kroonmolen',46,'2026-08-24','2026-08-24','delivered',NULL),
('SHP-30002','SO-24002','BulkLine Carriers',30,'2026-08-24','2026-08-24','delivered',NULL),
('SHP-30003','SO-24003','BulkLine Carriers',33,'2026-08-27','2026-08-27','delivered',NULL),
('SHP-30004','SO-24004','BulkLine Carriers',46,'2026-08-29','2026-08-29','delivered',NULL),
('SHP-30005','SO-24005','BulkLine Carriers',50,'2026-09-02','2026-09-02','delivered',NULL),
('SHP-30006','SO-24006','Veldhuis Bulk Transport',19,'2026-09-03','2026-09-03','delivered',NULL),
('SHP-30007','SO-24007','Own fleet Kroonmolen',12,'2026-09-07','2026-09-07','delivered',NULL),
('SHP-30008','SO-24008','Veldhuis Bulk Transport',8,'2026-09-10','2026-09-10','delivered',NULL),
('SHP-30009','SO-24010','Veldhuis Bulk Transport',35,'2026-09-11','2026-09-11','delivered',NULL),
('SHP-30010','SO-24011','Veldhuis Bulk Transport',79.0,'2026-09-13','2026-09-13','delivered',NULL),
('SHP-30011','SO-24012','Veldhuis Bulk Transport',126,'2026-09-15','2026-09-15','delivered',NULL),
('SHP-30012','SO-24013','Schelde Agri Freight',44,'2026-09-20','2026-09-20','delivered',NULL),
('SHP-30013','SO-24014','Schelde Agri Freight',52,'2026-09-21','2026-09-23','delivered','Storm warning, driver rest period'),
('SHP-30014','SO-24015','Veldhuis Bulk Transport',46,'2026-09-21','2026-09-21','delivered',NULL),
('SHP-30015','SO-24016','BulkLine Carriers',40,'2026-09-27','2026-09-28','delivered','Pellet line 2 maintenance overran by one shift'),
('SHP-30016','SO-24017','Veldhuis Bulk Transport',28,'2026-09-27','2026-09-27','delivered',NULL),
('SHP-30017','SO-24018','Veldhuis Bulk Transport',25.0,'2026-09-28','2026-09-28','delivered',NULL),
('SHP-30018','SO-24018','Schelde Agri Freight',25.0,'2026-10-01',NULL,'delayed','Raw material (soy meal) arrived late at mill'),
('SHP-30019','SO-24019','BulkLine Carriers',84,'2026-09-28','2026-09-28','delivered',NULL),
('SHP-30020','SO-24020','BulkLine Carriers',4,'2026-09-30','2026-09-30','delivered',NULL),
('SHP-30021','SO-24021','Noordwolde Logistics',12,'2026-09-30','2026-09-30','delivered',NULL),
('SHP-30022','SO-24022','BulkLine Carriers',16,'2026-10-02','2026-10-02','delivered',NULL),
('SHP-30023','SO-24023','Veldhuis Bulk Transport',4,'2026-10-03','2026-10-03','delivered',NULL),
('SHP-30024','SO-24025','Schelde Agri Freight',28,'2026-10-04','2026-10-04','delivered',NULL),
('SHP-30025','SO-24026','Own fleet Kroonmolen',10,'2026-10-04','2026-10-04','delivered',NULL),
('SHP-30026','SO-24027','Noordwolde Logistics',58,'2026-10-10','2026-10-10','delivered',NULL),
('SHP-30027','SO-24028','BulkLine Carriers',41.0,'2026-10-11','2026-10-11','delivered',NULL),
('SHP-30028','SO-24029','Own fleet Kroonmolen',13.0,'2026-10-13','2026-10-14','delivered','Truck breakdown on A28 near Meppel'),
('SHP-30029','SO-24030','BulkLine Carriers',11.0,'2026-10-14','2026-10-14','delivered',NULL),
('SHP-30030','SO-24030','Veldhuis Bulk Transport',11.0,'2026-10-17',NULL,'delayed','Border paperwork hold at Hazeldonk'),
('SHP-30031','SO-24031','Veldhuis Bulk Transport',35,'2026-10-14','2026-10-14','delivered',NULL),
('SHP-30032','SO-24032','BulkLine Carriers',4,'2026-10-22','2026-10-22','delivered',NULL),
('SHP-30033','SO-24033','Schelde Agri Freight',42,'2026-10-23','2026-10-23','delivered',NULL),
('SHP-30034','SO-24034','Schelde Agri Freight',54,'2026-10-24','2026-10-25','delivered','Carrier capacity shortage this week'),
('SHP-30035','SO-24035','BulkLine Carriers',28,'2026-10-27','2026-10-27','delivered',NULL),
('SHP-30036','SO-24036','Own fleet Kroonmolen',26,'2026-11-06','2026-11-06','in_transit',NULL),
('SHP-30037','SO-24037','Noordwolde Logistics',19,'2026-11-07','2026-11-09','delivered','Truck breakdown on A28 near Meppel'),
('SHP-30038','SO-24039','BulkLine Carriers',90,'2026-11-08','2026-11-08','delivered',NULL),
('SHP-30039','SO-24040','Own fleet Kroonmolen',42,'2026-11-08','2026-11-08','delivered',NULL),
('SHP-30040','SO-24041','Veldhuis Bulk Transport',43.5,'2026-11-09','2026-11-09','in_transit',NULL),
('SHP-30041','SO-24042','Own fleet Kroonmolen',28.0,'2026-11-09','2026-11-09','delivered',NULL),
('SHP-30042','SO-24042','Own fleet Kroonmolen',28.0,'2026-11-12',NULL,'delayed','Border paperwork hold at Hazeldonk'),
('SHP-30043','SO-24043','BulkLine Carriers',80,'2026-11-17',NULL,'planned',NULL),
('SHP-30044','SO-24044','Schelde Agri Freight',62,'2026-11-18',NULL,'planned',NULL),
('SHP-30045','SO-24045','Noordwolde Logistics',35,'2026-11-13',NULL,'delayed','Raw material (soy meal) arrived late at mill'),
('SHP-30046','SO-24046','Own fleet Kroonmolen',4,'2026-11-18',NULL,'planned',NULL),
('SHP-30047','SO-24047','Noordwolde Logistics',16,'2026-11-18',NULL,'planned',NULL),
('SHP-30048','SO-24048','BulkLine Carriers',60,'2026-11-16',NULL,'delayed','Carrier capacity shortage this week'),
('SHP-30049','SO-24049','BulkLine Carriers',64,'2026-11-17',NULL,'loaded',NULL),
('SHP-30050','SO-24051','BulkLine Carriers',19,'2026-11-17',NULL,'delayed','Storm warning, driver rest period'),
('SHP-30051','SO-24054','Noordwolde Logistics',38,'2026-11-23',NULL,'planned',NULL),
('SHP-30052','SO-24055','Veldhuis Bulk Transport',2,'2026-11-17',NULL,'planned',NULL),
('SHP-30053','SO-24056','Noordwolde Logistics',6,'2026-11-19',NULL,'planned',NULL),
('SHP-30054','SO-24057','Own fleet Kroonmolen',32,'2026-11-21',NULL,'planned',NULL);

INSERT INTO public.invoices (id,order_id,customer_id,invoice_date,due_date,amount_excl_vat,vat_rate,amount_incl_vat,status,paid_date) VALUES
('INV-50001','SO-24001','CUST-1014','2026-08-24','2026-09-14',21112.0,6,22378.72,'paid','2026-09-13'),
('INV-50002','SO-24002','CUST-1011','2026-08-24','2026-09-23',10564.0,6,11197.84,'paid','2026-09-18'),
('INV-50003','SO-24003','CUST-1003','2026-08-27','2026-09-17',13238.0,9,14429.42,'paid','2026-09-15'),
('INV-50004','SO-24004','CUST-1010','2026-08-29','2026-10-28',21250.76,9,23163.33,'paid','2026-10-27'),
('INV-50005','SO-24005','CUST-1002','2026-09-02','2026-10-02',17290.0,9,18846.1,'paid','2026-09-24'),
('INV-50006','SO-24006','CUST-1011','2026-09-03','2026-10-03',7182.0,6,7612.92,'overdue',NULL),
('INV-50007','SO-24007','CUST-1001','2026-09-07','2026-10-07',4020.0,9,4381.8,'paid','2026-10-02'),
('INV-50008','SO-24008','CUST-1008','2026-09-10','2026-09-24',3320.0,9,3618.8,'overdue',NULL),
('INV-50009','SO-24010','CUST-1007','2026-09-11','2026-10-11',11978.0,9,13056.02,'overdue',NULL),
('INV-50010','SO-24011','CUST-1013','2026-09-13','2026-10-28',27602.32,6,29258.46,'paid','2026-10-25'),
('INV-50011','SO-24012','CUST-1006','2026-09-15','2026-10-30',47731.76,9,52027.62,'paid','2026-10-30'),
('INV-50012','SO-24013','CUST-1013','2026-09-20','2026-11-04',17421.2,6,18466.47,'overdue',NULL),
('INV-50013','SO-24014','CUST-1005','2026-09-21','2026-11-05',20412.68,9,22249.82,'paid','2026-11-04'),
('INV-50014','SO-24015','CUST-1012','2026-09-21','2026-10-21',17408.0,6,18452.48,'paid','2026-10-18'),
('INV-50015','SO-24016','CUST-1007','2026-09-27','2026-10-27',13620.0,9,14845.8,'paid','2026-10-26'),
('INV-50016','SO-24017','CUST-1011','2026-09-27','2026-10-27',9450.0,6,10017.0,'paid','2026-10-20'),
('INV-50017','SO-24018','CUST-1003','2026-09-28','2026-10-19',9746.0,9,10623.14,'paid','2026-10-14'),
('INV-50018','SO-24019','CUST-1010','2026-09-28','2026-11-27',30229.08,9,32949.7,'open',NULL),
('INV-50019','SO-24020','CUST-1002','2026-09-30','2026-10-30',1640.0,9,1787.6,'paid','2026-10-24'),
('INV-50020','SO-24021','CUST-1008','2026-09-30','2026-10-14',5046.0,9,5500.14,'overdue',NULL),
('INV-50021','SO-24022','CUST-1001','2026-10-02','2026-11-01',5568.0,9,6069.12,'overdue',NULL),
('INV-50022','SO-24023','CUST-1008','2026-10-03','2026-10-17',1660.0,9,1809.4,'paid','2026-10-14'),
('INV-50023','SO-24025','CUST-1007','2026-10-04','2026-11-03',9380.0,9,10224.2,'overdue',NULL),
('INV-50024','SO-24026','CUST-1007','2026-10-04','2026-11-03',3420.0,9,3727.8,'paid','2026-10-31'),
('INV-50025','SO-24027','CUST-1006','2026-10-10','2026-11-24',24067.64,9,26233.73,'paid','2026-10-19'),
('INV-50026','SO-24028','CUST-1013','2026-10-11','2026-11-25',16462.84,6,17450.61,'open',NULL),
('INV-50027','SO-24029','CUST-1005','2026-10-13','2026-11-27',5873.35,9,6401.95,'open',NULL),
('INV-50028','SO-24030','CUST-1012','2026-10-14','2026-11-13',4725.0,6,5008.5,'paid','2026-11-13'),
('INV-50029','SO-24031','CUST-1003','2026-10-14','2026-11-04',13488.0,9,14701.92,'paid','2026-11-01'),
('INV-50030','SO-24032','CUST-1011','2026-10-22','2026-11-21',1580.0,6,1674.8,'open',NULL),
('INV-50031','SO-24033','CUST-1003','2026-10-23','2026-11-13',14484.0,9,15787.56,'paid','2026-11-09'),
('INV-50032','SO-24034','CUST-1010','2026-10-24','2026-12-23',22674.72,9,24715.44,'open',NULL),
('INV-50033','SO-24035','CUST-1002','2026-10-27','2026-11-26',9450.0,9,10300.5,'open',NULL),
('INV-50034','SO-24036','CUST-1007','2026-11-06','2026-12-06',8780.0,9,9570.2,'open',NULL),
('INV-50035','SO-24037','CUST-1001','2026-11-07','2026-12-07',6922.0,9,7544.98,'open',NULL),
('INV-50036','SO-24039','CUST-1015','2026-11-08','2027-01-07',31598.72,6,33494.64,'open',NULL),
('INV-50037','SO-24040','CUST-1007','2026-11-08','2026-12-08',14290.0,9,15576.1,'open',NULL),
('INV-50038','SO-24041','CUST-1002','2026-11-09','2026-12-09',15972.0,9,17409.48,'open',NULL),
('INV-50039','SO-24042','CUST-1006','2026-11-09','2026-12-24',11733.12,9,12789.1,'open',NULL),
('INV-50040','SO-24045','CUST-1012','2026-11-13','2026-12-13',13200.0,6,13992.0,'open',NULL),
('INV-50041','SO-24048','CUST-1003','2026-11-16','2026-12-07',22530.0,9,24557.7,'open',NULL),
('INV-50042','SO-24051','CUST-1001','2026-11-17','2026-12-17',6922.0,9,7544.98,'open',NULL);

-- Seed activity history derived from the seeded orders, shipments and invoices
INSERT INTO public.order_activity (order_id,event,from_status,to_status,actor,created_at)
SELECT o.id,'Order created',NULL,'confirmed','sales.desk',o.created_at FROM public.sales_orders o;

INSERT INTO public.order_activity (order_id,event,from_status,to_status,actor,created_at)
SELECT o.id,'Status changed',p.from_status,p.to_status,p.actor,
  LEAST((o.order_date + p.day_offset)::timestamp, '2026-11-17 07:00'::timestamp)
    + make_interval(hours => 7 + abs(hashtext(o.id || p.to_status)) % 9, mins => abs(hashtext(p.to_status || o.id)) % 60)
FROM public.sales_orders o
JOIN (VALUES
  ('in_production','confirmed','in_production',1,'planning'),
  ('ready_to_ship','confirmed','in_production',1,'planning'),('ready_to_ship','in_production','ready_to_ship',3,'planning'),
  ('shipped','confirmed','in_production',1,'planning'),('shipped','in_production','ready_to_ship',3,'planning'),('shipped','ready_to_ship','shipped',4,'logistics'),
  ('delivered','confirmed','in_production',1,'planning'),('delivered','in_production','ready_to_ship',3,'planning'),('delivered','ready_to_ship','shipped',4,'logistics'),('delivered','shipped','delivered',5,'logistics'),
  ('partially_shipped','confirmed','in_production',1,'planning'),('partially_shipped','in_production','ready_to_ship',3,'planning'),('partially_shipped','ready_to_ship','partially_shipped',4,'logistics'),
  ('cancelled','confirmed','cancelled',1,'sales.desk')
) AS p(final_status,from_status,to_status,day_offset,actor) ON p.final_status = o.status;

INSERT INTO public.order_activity (order_id,event,from_status,to_status,actor,created_at)
SELECT i.order_id,'Invoice ' || i.id || ' issued',NULL,NULL,'finance',i.invoice_date + time '17:00' FROM public.invoices i;

INSERT INTO public.order_activity (order_id,event,from_status,to_status,actor,created_at)
SELECT s.order_id,'Shipment ' || s.id || ' delayed: ' || s.delay_reason,'planned','delayed','logistics',s.planned_date + time '06:30'
FROM public.shipments s WHERE s.status = 'delayed';

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_activity (order_id, event, from_status, to_status, actor)
    VALUES (NEW.id, 'Order created', NULL, NEW.status, COALESCE(auth.jwt() ->> 'email', 'system'));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.updated_at := now();
    INSERT INTO public.order_activity (order_id, event, from_status, to_status, actor)
    VALUES (NEW.id, 'Status changed', OLD.status, NEW.status, COALESCE(auth.jwt() ->> 'email', 'system'));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER sales_orders_status_log_ins AFTER INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();
CREATE TRIGGER sales_orders_status_log_upd BEFORE UPDATE OF status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

CREATE OR REPLACE FUNCTION public.log_shipment_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_activity (order_id, event, from_status, to_status, actor)
    VALUES (NEW.order_id, 'Shipment ' || NEW.id || ' status changed', OLD.status, NEW.status, COALESCE(auth.jwt() ->> 'email', 'system'));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shipments_status_log AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.log_shipment_status_change();

CREATE OR REPLACE FUNCTION public.log_invoice_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_activity (order_id, event, from_status, to_status, actor)
    VALUES (NEW.order_id, 'Invoice ' || NEW.id || ' status changed', OLD.status, NEW.status, COALESCE(auth.jwt() ->> 'email', 'system'));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invoices_status_log AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_invoice_status_change();

REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_shipment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_invoice_status_change() FROM PUBLIC, anon, authenticated;