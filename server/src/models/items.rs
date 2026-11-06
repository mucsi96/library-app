use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "loan_items", schema_name = "library")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub isbn: Option<String>,
    pub media_type: String,
    pub title: String,
    pub author: Option<String>,
    pub library: Option<String>,
    pub due_date: Option<Date>,
    pub status: Status,
}

#[derive(Clone, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum, Deserialize, Serialize)]
#[sea_orm(rs_type = "String", db_type = "Text")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Status {
    #[sea_orm(string_value = "LOANED")]
    Loaned,
    #[sea_orm(string_value = "NOT_STARTED")]
    NotStarted,
    #[sea_orm(string_value = "READING")]
    Reading,
    #[sea_orm(string_value = "READ")]
    Read,
    #[sea_orm(string_value = "READ_RETURNED")]
    ReadReturned,
    #[sea_orm(string_value = "UNREAD_RETURNED")]
    UnreadReturned,
}

impl Status {
    pub fn on_shelf(self, own: bool) -> Self {
        match self {
            Self::ReadReturned => Self::Read,
            Self::Loaned | Self::UnreadReturned if own => Self::NotStarted,
            Self::NotStarted | Self::UnreadReturned if !own => Self::Loaned,
            status => status,
        }
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}
impl ActiveModelBehavior for ActiveModel {}
