use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "import_jobs", schema_name = "library")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    #[serde(skip)]
    pub id: i64,
    pub reference: Uuid,
    pub status: String,
    #[serde(skip)]
    pub front_photo: String,
    #[serde(skip)]
    pub back_photo: String,
    pub isbn: Option<String>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub media_type: Option<String>,
    pub library: Option<String>,
    #[serde(rename = "itemId")]
    pub loan_item_id: Option<i64>,
    pub error_detail: Option<String>,
    #[serde(skip)]
    pub attempts: i32,
    #[serde(skip)]
    pub next_attempt_at: DateTimeWithTimeZone,
    pub created_at: DateTimeWithTimeZone,
    #[serde(skip)]
    pub updated_at: DateTimeWithTimeZone,
}
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
